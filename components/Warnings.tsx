import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { PlanSuggestion, Profile, Warning } from "@/lib/types";
import { formatEGP } from "@/lib/engine";

function formatDate(d: Date): string {
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function Warnings({
  profile,
  warning,
  plan,
  daily,
}: {
  profile: Profile;
  warning: Warning | null;
  plan: PlanSuggestion[];
  daily: { date: Date; balance: number }[];
}) {
  const horizon = daily.length;
  const chartMax = useMemo(() => Math.max(...daily.map((d) => d.balance), profile.startingBalance), [daily, profile.startingBalance]);
  const chartMin = useMemo(() => Math.min(...daily.map((d) => d.balance), 0), [daily]);
  const range = Math.max(chartMax - chartMin, 1);

  return (
    <div className="grid gap-4">
      {warning ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/15">تحذير مبكر</Badge>
              <CardTitle>خلال {warning.daysAhead} يوم ستحتاج {formatEGP(warning.shortfall)} غير متوفرة في مسارك الحالي.</CardTitle>
            </div>
            <CardDescription>
              في {formatDate(warning.date)} ينزل رصيدك المتوقع تحت {formatEGP(profile.safetyBuffer)}. {warning.cause}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-24 w-full overflow-hidden rounded-lg border border-border bg-muted/40" dir="ltr" role="img" aria-label={`الرصيد اليومي المتوقع خلال ${horizon} يوماً، ينزل تحت الحد الآمن في ${formatDate(warning.date)}`}>
              <svg viewBox={`0 0 ${horizon} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <line
                  x1={0} x2={horizon}
                  y1={100 - ((profile.safetyBuffer - chartMin) / range) * 100}
                  y2={100 - ((profile.safetyBuffer - chartMin) / range) * 100}
                  stroke="var(--warning)" strokeWidth={0.8} strokeDasharray="3 2" vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={daily.map((d, i) => `${i},${100 - ((d.balance - chartMin) / range) * 100}`).join(" ")}
                  fill="none" stroke="var(--chart-1)" strokeWidth={1.6} vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={warning.daysAhead - 1}
                  cy={100 - (((daily[warning.daysAhead - 1]?.balance ?? chartMin) - chartMin) / range) * 100}
                  r={1.4} fill="var(--destructive)"
                />
              </svg>
              <span className="absolute bottom-1.5 left-2 text-[11px] text-muted-foreground">اليوم</span>
              <span className="absolute bottom-1.5 right-2 text-[11px] text-muted-foreground">+{horizon} يوم</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">كله تمام</Badge>
              <CardTitle>لا عجز متوقع خلال {horizon} يوماً</CardTitle>
            </div>
            <CardDescription>
              رصيدك المتوقع يبقى فوق {formatEGP(profile.safetyBuffer)} حتى {formatDate(daily[daily.length - 1].date)}. تابع الصندوق الزمني للصورة الأطول.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-24 w-full overflow-hidden rounded-lg border border-border bg-muted/40" dir="ltr" role="img" aria-label={`الرصيد اليومي المتوقع خلال ${horizon} يوماً، يبقى فوق الحد الآمن`}>
              <svg viewBox={`0 0 ${horizon} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <polyline
                  points={daily.map((d, i) => `${i},${100 - ((d.balance - chartMin) / range) * 100}`).join(" ")}
                  fill="none" stroke="var(--chart-1)" strokeWidth={1.6} vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span className="absolute bottom-1.5 left-2 text-[11px] text-muted-foreground">اليوم</span>
              <span className="absolute bottom-1.5 right-2 text-[11px] text-muted-foreground">+{horizon} يوم</span>
            </div>
          </CardContent>
        </Card>
      )}

      {warning && plan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>أضع لك خطة؟</CardTitle>
            <CardDescription>مرتبة حسب حجم ما تغطيه من عجز {formatEGP(warning.shortfall)}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {plan.map((s, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                  <span className="tnum shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    +{formatEGP(s.impact)}
                  </span>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              تغطية عجز {formatEGP(warning.shortfall)} تحتاج أي مجموعة خيارات مجموعها يساوي العجز — الخيار الأول وحده يكفي، أو خياران أصغر معاً.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
