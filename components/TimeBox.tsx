import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Insights, MonthPoint, Profile } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { formatEGP } from "@/lib/engine";

const HORIZONS = [
  { value: "1", months: 1, label: "شهر" },
  { value: "3", months: 3, label: "3 شهور" },
  { value: "12", months: 12, label: "سنة" },
  { value: "60", months: 60, label: "5 سنوات" },
] as const;

interface DangerZone {
  start: number;
  end: number;
  worst: MonthPoint;
}

function findZones(points: MonthPoint[]): DangerZone[] {
  const zones: DangerZone[] = [];
  let current: DangerZone | null = null;
  for (const p of points) {
    if (p.danger) {
      if (!current) current = { start: p.index, end: p.index, worst: p };
      else {
        current.end = p.index;
        if (p.minBalance < current.worst.minBalance) current.worst = p;
      }
    } else if (current) {
      zones.push(current);
      current = null;
    }
  }
  if (current) zones.push(current);
  return zones;
}

export function TimeBox({ profile, points, insights }: { profile: Profile; points: MonthPoint[]; insights: Insights }) {
  const horizonMonths = useRef(60);
  const [horizon, setHorizon] = useState<string>("60");
  const months = HORIZONS.find((h) => h.value === horizon)?.months ?? 60;
  horizonMonths.current = months;

  const visible = useMemo(() => points.slice(0, months), [points, months]);
  const zones = useMemo(() => findZones(visible), [visible]);

  const [playhead, setPlayhead] = useState(months - 1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlayhead(months - 1);
    setPlaying(false);
  }, [months]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPlayhead((p) => {
        if (p >= months - 1) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, months > 12 ? 90 : 400);
    return () => window.clearInterval(id);
  }, [playing, months]);

  const clampedPlayhead = Math.min(playhead, months - 1);
  const nowPoint = visible[clampedPlayhead];

  const activeZone = zones.find((z) => clampedPlayhead >= z.start && clampedPlayhead <= z.end) ?? null;
  const upcomingZone = zones.find((z) => z.start > clampedPlayhead) ?? null;

  const data = visible.map((p) => ({
    name: p.label,
    index: p.index,
    balance: Math.round(p.closingBalance),
    min: Math.round(p.minBalance),
  }));

  const config: ChartConfig = {
    balance: { label: "الرصيد المتوقع", color: "var(--chart-1)" },
  };

  function explainZone(zone: DangerZone): string {
    const worst = zone.worst;
    const gap = profile.safetyBuffer - worst.minBalance;
    const reasons: string[] = [];
    if (insights.netMonthly < 0) {
      reasons.push(`أنك تنفق أكثر من دخلك بـ ${formatEGP(Math.abs(insights.netMonthly))} كل شهر`);
    }
    const top = insights.topShare;
    if (top && top.pctOfIncome >= 30) {
      reasons.push(`${top.pctOfIncome.toFixed(0)}% من دخلك يذهب إلى ${CATEGORY_LABELS[top.category]}`);
    }
    const bigBill = [...profile.fixed].sort((a, b) => b.amount - a.amount)[0];
    if (bigBill && bigBill.amount > profile.monthlyIncome * 0.3) {
      reasons.push(`${bigBill.name} وحده يستهلك ${((bigBill.amount / Math.max(profile.monthlyIncome, 1)) * 100).toFixed(0)}% من دخلك`);
    }
    if (reasons.length === 0) reasons.push("دفعة استثنائية تستنزف الاحتياطي");
    return `حوالي ${worst.label} ينقصك ما يقارب ${formatEGP(gap)} — السبب: ${reasons.join("، و")}.`;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>الصندوق الزمني</CardTitle>
              <CardDescription>شغّل مستقبلك المالي كفيلم. الأشرطة الحمراء هي مناطق الخطر.</CardDescription>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={horizon}
              onValueChange={(v) => v && setHorizon(v)}
              aria-label="المدى الزمني"
            >
              {HORIZONS.map((h) => (
                <ToggleGroupItem key={h.value} value={h.value}>{h.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer config={config} className="aspect-[21/8] w-full" dir="ltr">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              {zones.map((z) => (
                <ReferenceArea
                  key={`${z.start}-${z.end}`}
                  x1={visible[z.start].label}
                  x2={visible[z.end].label}
                  fill="var(--destructive)"
                  fillOpacity={0.14}
                  stroke="var(--destructive)"
                  strokeOpacity={0.35}
                  strokeDasharray="4 4"
                />
              ))}
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(visible.length / 8))}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatEGP(Number(v), true)} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatEGP(Number(v))} />} />
              <ReferenceLine y={profile.safetyBuffer} stroke="var(--warning)" strokeDasharray="6 4" label={{ value: "حد الخطر", fill: "var(--warning)", fontSize: 11, position: "insideTopRight" }} />
              <ReferenceLine x={visible[clampedPlayhead]?.label} stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={1.5} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#balanceFill)"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ChartContainer>

          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <Button
              onClick={() => {
                if (clampedPlayhead >= months - 1) setPlayhead(0);
                setPlaying((p) => !p);
              }}
              className="w-28"
            >
              {playing ? "❚❚ إيقاف" : "▶ تشغيل"}
            </Button>
            <div className="grid gap-1" dir="ltr">
              <Slider
                value={[clampedPlayhead]}
                min={0}
                max={Math.max(months - 1, 1)}
                step={1}
                onValueChange={([v]) => {
                  setPlaying(false);
                  setPlayhead(v);
                }}
                aria-label="التنقل عبر الزمن"
              />
              <div className="flex justify-between text-xs text-muted-foreground" dir="rtl">
                <span>اليوم</span>
                <span>{visible[months - 1]?.label}</span>
              </div>
            </div>
          </div>

          {nowPoint && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              <span className="font-medium">{nowPoint.label}</span>
              <span className="tnum text-muted-foreground">
                الرصيد <span className={nowPoint.closingBalance < profile.safetyBuffer ? "text-destructive" : "text-primary"}>{formatEGP(nowPoint.closingBalance)}</span>
              </span>
              <span className="tnum text-muted-foreground">داخل {formatEGP(nowPoint.income, true)} · خارج {formatEGP(nowPoint.expenses, true)}</span>
              {nowPoint.danger && <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/15">منطقة خطر</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {activeZone ? "أنت الآن داخل منطقة خطر" : upcomingZone ? "منطقة الخطر القادمة" : "مناطق الخطر"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {zones.length === 0 ? (
              <p className="text-muted-foreground">
                لا مناطق خطر خلال {months >= 60 ? "السنوات الخمس" : `${months} شهر`} القادمة على مسارك الحالي. رصيدك يبقى فوق {formatEGP(profile.safetyBuffer)}.
              </p>
            ) : (
              <>
                <p className={activeZone ? "text-destructive" : "text-warning"}>
                  {(activeZone ?? upcomingZone) && explainZone(activeZone ?? upcomingZone!)}
                </p>
                <ul className="grid gap-1.5">
                  {zones.slice(0, 5).map((z) => (
                    <li key={z.start} className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <button
                        className="tnum text-right text-destructive underline-offset-2 hover:underline"
                        onClick={() => { setPlaying(false); setPlayhead(z.worst.index); }}
                      >
                        {z.start === z.end ? visible[z.start].label : `${visible[z.start].label} ← ${visible[z.end].label}`}
                      </button>
                      <span className="tnum text-xs text-muted-foreground">الأسوأ: {formatEGP(z.worst.minBalance)}</span>
                    </li>
                  ))}
                  {zones.length > 5 && <li className="text-xs text-muted-foreground">+ {zones.length - 5} مناطق أخرى أبعد</li>}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">كيف تقرأ هذا</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>الخط هو رصيدك المتوقع شهراً بشهر، مبني على محاكاة فواتيرك الحقيقية ويوم راتبك وعاداتك — كل جنيه داخل وخارج.</p>
            <p>الأشرطة الحمراء تحدد الشهور التي ينزل فيها رصيدك تحت حد الخطر ({formatEGP(profile.safetyBuffer)}). اضغط أي منطقة لنقل الخط الزمني إليها.</p>
            <p>استخدم محاكي القرارات لإعادة تشغيل هذا المستقبل مع قسط سيارة أو ترك العمل أو استثمار شهري — وقارن المسارين جنباً إلى جنب.</p>
            {insights.runwayMonths !== null && (
              <p className="text-warning">
                على المسار الحالي تبدأ المشكلة خلال {insights.runwayMonths} شهر ({insights.firstDanger?.label}).
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
