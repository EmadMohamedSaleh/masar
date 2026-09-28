import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Insights, Profile } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { formatEGP } from "@/lib/engine";

const CATEGORY_COLORS: Record<string, string> = {
  housing: "var(--chart-2)",
  loans: "var(--chart-4)",
  subscriptions: "var(--chart-3)",
  food: "var(--chart-1)",
  dining: "var(--chart-5)",
  transport: "var(--chart-3)",
  other: "var(--muted-foreground)",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`tnum text-xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}

export function Overview({ profile, insights }: { profile: Profile; insights: Insights }) {
  const pieData = useMemo(
    () => insights.shares.filter((s) => s.amount > 0).map((s) => ({
      name: CATEGORY_LABELS[s.category],
      category: s.category,
      value: Math.round(s.amount),
    })),
    [insights.shares],
  );
  const pieConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const d of pieData) cfg[d.category] = { label: d.name, color: CATEGORY_COLORS[d.category] };
    return cfg;
  }, [pieData]);

  const weekData = insights.weeklyMin.map((v, i) => ({ week: `أسبوع ${i + 1}`, balance: Math.round(v) }));
  const weekConfig: ChartConfig = { balance: { label: "أدنى رصيد", color: "var(--chart-2)" } };

  const top = insights.topShare;
  const dangerSoon = insights.runwayMonths !== null && insights.runwayMonths <= 6;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="الرصيد الحالي" value={formatEGP(profile.startingBalance)} />
        <Stat
          label="الصافي الشهري"
          value={`${insights.netMonthly >= 0 ? "+" : "−"}${formatEGP(Math.abs(insights.netMonthly))}`}
          tone={insights.netMonthly >= 0 ? "good" : "bad"}
        />
        <Stat
          label="معدل الادخار"
          value={`${insights.savingsRatePct >= 0 ? "" : "−"}${Math.abs(insights.savingsRatePct).toFixed(0)}%`}
          tone={insights.savingsRatePct >= 20 ? "good" : insights.savingsRatePct >= 0 ? "warn" : "bad"}
        />
        <Stat
          label="مدة الصمود"
          value={insights.runwayMonths === null ? "+60 شهراً" : `${insights.runwayMonths} شهر`}
          tone={insights.runwayMonths === null ? "good" : dangerSoon ? "bad" : "warn"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>إلى أين تذهب أموالك</CardTitle>
            <CardDescription>
              {top
                ? `أكبر بند إنفاق لديك هو ${CATEGORY_LABELS[top.category]} بنسبة ${top.pctOfIncome.toFixed(0)}% من دخلك.`
                : "أضف مصروفاتك لرؤية التوزيع."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieConfig} className="mx-auto aspect-[4/3] w-full max-w-md" dir="ltr">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="55%" strokeWidth={2}>
                  {pieData.map((d) => (
                    <Cell key={d.category} fill={CATEGORY_COLORS[d.category]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-2 grid gap-1.5 text-sm">
              {insights.shares.filter((s) => s.amount > 0).map((s) => (
                <li key={s.category} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: CATEGORY_COLORS[s.category] }} />
                    {CATEGORY_LABELS[s.category]}
                  </span>
                  <span className="tnum text-muted-foreground">
                    {formatEGP(s.amount)} · {s.pctOfIncome.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>متى تنفد الأموال</CardTitle>
              <CardDescription>في شهر نموذجي، حسب يوم راتبك وفواتيرك.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {insights.runoutDay === null ? (
                <p className="flex items-center gap-2 text-sm">
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">وضع صحي</Badge>
                  رصيدك يبقى فوق {formatEGP(profile.safetyBuffer)} طوال الشهر.
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm">
                  <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/15">أزمة</Badge>
                  رصيدك ينزل تحت الحد الآمن حوالي <strong className="tnum">يوم {insights.runoutDay}</strong> من الشهر.
                </p>
              )}
              {insights.tightWeek && (
                <p className="text-sm text-muted-foreground">
                  الأسبوع {insights.tightWeek} هو الأصعب عليك باستمرار — خطط المشتريات الكبيرة في الأسبوع الأول.
                </p>
              )}
              <ChartContainer config={weekConfig} className="aspect-[16/7] w-full" dir="ltr">
                <BarChart data={weekData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatEGP(Number(v), true)} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatEGP(Number(v))} />} />
                  <Bar dataKey="balance" radius={[4, 4, 0, 0]} fill="var(--chart-2)">
                    {weekData.map((d) => (
                      <Cell key={d.week} fill={d.balance < profile.safetyBuffer ? "var(--destructive)" : "var(--chart-2)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground">أدنى رصيد متوقع في كل أسبوع من شهر نموذجي.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ماذا تعلّم التوأم</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                <li className="flex gap-2">
                  <span aria-hidden>←</span>
                  {insights.netMonthly >= 0
                    ? `تحتفظ بـ ${formatEGP(insights.netMonthly)} كل شهر. خلال 5 سنوات يتجمع منها ${formatEGP(insights.netMonthly * 60)} قبل أي عوائد.`
                    : `تخسر ${formatEGP(Math.abs(insights.netMonthly))} كل شهر. بهذا المعدل ينتهي رصيدك خلال ${insights.runwayMonths ?? "أقل من"} شهر.`}
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>←</span>
                  {top && top.pctOfIncome > 35
                    ? `${CATEGORY_LABELS[top.category]} وحده يستهلك ${top.pctOfIncome.toFixed(0)}% من دخلك — وهو الرافع الأكثر تأثيراً لديك.`
                    : top
                      ? `لا توجد فئة مسيطرة: أكبرها ${CATEGORY_LABELS[top.category]} بنسبة ${top.pctOfIncome.toFixed(0)}% من دخلك.`
                      : "أضف الفئات لرؤية تحليل عاداتك."}
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>←</span>
                  {insights.firstDanger
                    ? `تظهر منطقة خطر في ${insights.firstDanger.label}: ينزل رصيدك إلى ${formatEGP(insights.firstDanger.minBalance)}. افتح الصندوق الزمني لمعرفة السبب.`
                    : "لا مناطق خطر في السنوات الخمس القادمة على مسارك الحالي."}
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
