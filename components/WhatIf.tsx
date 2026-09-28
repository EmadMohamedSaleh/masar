import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MonthPoint, Profile, Scenario } from "@/lib/types";
import { formatEGP, loanMonthlyPayment, simulate } from "@/lib/engine";

type PresetKind = "loan" | "income-stop" | "invest";

interface PresetDef {
  kind: PresetKind;
  title: string;
  question: string;
  icon: string;
}

const PRESETS: PresetDef[] = [
  { kind: "loan", title: "شراء بالتقسيط", question: "ماذا لو اشتريت هذه السيارة/الموبايل بالتقسيط؟", icon: "🚗" },
  { kind: "income-stop", title: "ترك العمل والسفر", question: "ماذا لو تركت عملي وسافرت لفترة؟", icon: "✈️" },
  { kind: "invest", title: "استثمار شهري", question: "ماذا لو استثمرت مبلغاً ثابتاً كل شهر؟", icon: "📈" },
];

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          min={0}
          dir="ltr"
          className="tnum pl-14 text-right"
          value={value || ""}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

export function WhatIf({ profile, baseline }: { profile: Profile; baseline: MonthPoint[] }) {
  const [kind, setKind] = useState<PresetKind | null>(null);
  const [horizonMonths] = useState(60);

  const [loan, setLoan] = useState({ amount: 500000, annualRatePct: 28, months: 60, downPayment: 100000, startInMonths: 1 });
  const [break_, setBreak] = useState({ stopMonths: 6, startInMonths: 1, extraMonthlyCost: 30000, severance: 0 });
  const [invest, setInvest] = useState({ monthlyAmount: 2000, annualReturnPct: 20 });

  const scenario: Scenario | null = useMemo(() => {
    if (kind === "loan") {
      return { kind: "loan", label: "تقسيط", amount: loan.amount, annualRatePct: loan.annualRatePct, months: loan.months, downPayment: loan.downPayment, startInMonths: loan.startInMonths };
    }
    if (kind === "income-stop") {
      return { kind: "income-stop", label: "انقطاع دخل", stopMonths: break_.stopMonths, startInMonths: break_.startInMonths, extraMonthlyCost: break_.extraMonthlyCost, severance: break_.severance };
    }
    if (kind === "invest") {
      return { kind: "invest", label: "استثمار شهري", monthlyAmount: invest.monthlyAmount, annualReturnPct: invest.annualReturnPct };
    }
    return null;
  }, [kind, loan, break_, invest]);

  const scenarioPoints = useMemo(
    () => (scenario ? simulate(profile, horizonMonths, scenario) : null),
    [profile, scenario, horizonMonths],
  );

  const chartData = useMemo(() => {
    if (!scenarioPoints) return [];
    return baseline.slice(0, horizonMonths).map((b, i) => ({
      name: b.label,
      baseline: Math.round(b.closingBalance),
      scenario: Math.round(scenarioPoints[i].closingBalance),
      netWorth: Math.round(scenarioPoints[i].netWorth),
    }));
  }, [baseline, scenarioPoints, horizonMonths]);

  const showNetWorth = kind === "invest";
  const config: ChartConfig = {
    baseline: { label: "مسارك الحالي", color: "var(--chart-2)" },
    scenario: { label: showNetWorth ? "الكاش مع الاستثمار" : "مع هذا القرار", color: "var(--chart-3)" },
    netWorth: { label: "الكاش + الاستثمارات", color: "var(--chart-1)" },
  };

  const verdict = useMemo(() => {
    if (!scenario || !scenarioPoints) return null;
    const last = scenarioPoints[scenarioPoints.length - 1];
    const baseLast = baseline[baseline.length - 1];
    const diff = (showNetWorth ? last.netWorth : last.closingBalance) - baseLast.closingBalance;
    const firstDanger = scenarioPoints.find((p) => p.danger);
    const baseDanger = baseline.find((p) => p.danger);
    let survival: string | null = null;
    if (scenario.kind === "income-stop") {
      const brokeAt = scenarioPoints.find((p) => p.closingBalance < profile.safetyBuffer);
      survival = brokeAt
        ? `يمكنك الصمود حوالي ${brokeAt.index} شهر قبل أن تنفد أموالك.`
        : `تصمد طوال فترة الانقطاع (${scenario.stopMonths} شهر) ويبقى لديك ${formatEGP(last.closingBalance)} بعد 5 سنوات.`;
    }
    return { diff, firstDanger, baseDanger, survival, last, baseLast };
  }, [scenario, scenarioPoints, baseline, showNetWorth, profile.safetyBuffer]);

  const monthlyLoanPayment = kind === "loan" ? loanMonthlyPayment(loan.amount, loan.annualRatePct, loan.months) : 0;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>محاكي القرارات</CardTitle>
          <CardDescription>جرّب أي قرار مالي على توأمك قبل اتخاذه في الواقع. اختر سيناريو:</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button
                key={p.kind}
                onClick={() => setKind(kind === p.kind ? null : p.kind)}
                aria-pressed={kind === p.kind}
                className={`rounded-xl border p-4 text-right transition-colors ${
                  kind === p.kind
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/40 hover:border-primary/40"
                }`}
              >
                <span className="text-2xl" aria-hidden>{p.icon}</span>
                <p className="mt-2 text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.question}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {kind && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{PRESETS.find((p) => p.kind === kind)?.question}</CardTitle>
            <CardDescription>اضبط السيناريو — والتوقعات تتحدث فوراً.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {kind === "loan" && (
              <>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Field label="السعر الكلي" value={loan.amount} onChange={(v) => setLoan({ ...loan, amount: v })} suffix="ج.م" />
                  <Field label="المقدم" value={loan.downPayment} onChange={(v) => setLoan({ ...loan, downPayment: Math.min(v, loan.amount) })} suffix="ج.م" />
                  <Field label="الفائدة السنوية" value={loan.annualRatePct} onChange={(v) => setLoan({ ...loan, annualRatePct: v })} suffix="%" />
                  <Field label="مدة التقسيط" value={loan.months} onChange={(v) => setLoan({ ...loan, months: Math.min(v, 120) })} suffix="شهر" />
                  <Field label="يبدأ بعد" value={loan.startInMonths} onChange={(v) => setLoan({ ...loan, startInMonths: v })} suffix="شهر" />
                </div>
                <p className="tnum text-sm text-muted-foreground">
                  القسط الشهري: <span className="font-medium text-foreground">{formatEGP(monthlyLoanPayment)}</span> لمدة {loan.months} شهر · الممول {formatEGP(loan.amount)} بفائدة {loan.annualRatePct}%
                </p>
              </>
            )}
            {kind === "income-stop" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="يبدأ بعد" value={break_.startInMonths} onChange={(v) => setBreak({ ...break_, startInMonths: v })} suffix="شهر" />
                <Field label="مدة الانقطاع" value={break_.stopMonths} onChange={(v) => setBreak({ ...break_, stopMonths: Math.min(v, 60) })} suffix="شهر" />
                <Field label="تكلفة السفر/المعيشة شهرياً" value={break_.extraMonthlyCost} onChange={(v) => setBreak({ ...break_, extraMonthlyCost: v })} suffix="ج.م" />
                <Field label="مكافأة نهاية خدمة/دفعة" value={break_.severance} onChange={(v) => setBreak({ ...break_, severance: v })} suffix="ج.م" />
              </div>
            )}
            {kind === "invest" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="استثمر كل شهر" value={invest.monthlyAmount} onChange={(v) => setInvest({ ...invest, monthlyAmount: v })} suffix="ج.م" />
                <Field label="العائد السنوي المتوقع" value={invest.annualReturnPct} onChange={(v) => setInvest({ ...invest, annualReturnPct: v })} suffix="%" />
              </div>
            )}

            {scenarioPoints && verdict && (
              <>
                <ChartContainer config={config} className="aspect-[21/9] w-full" dir="ltr">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={7} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatEGP(Number(v), true)} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatEGP(Number(v))} />} />
                    <Legend wrapperStyle={{ fontSize: 12, direction: "rtl" }} />
                    <ReferenceLine y={profile.safetyBuffer} stroke="var(--warning)" strokeDasharray="6 4" />
                    <Line type="monotone" dataKey="baseline" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                    <Line type="monotone" dataKey="scenario" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                    {showNetWorth && <Line type="monotone" dataKey="netWorth" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />}
                  </LineChart>
                </ChartContainer>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                    <p className="flex items-center gap-2">
                      <Badge className={verdict.diff >= 0 ? "bg-primary/15 text-primary hover:bg-primary/15" : "bg-destructive/15 text-destructive hover:bg-destructive/15"}>
                        {verdict.diff >= 0 ? "وضعك أفضل" : "وضعك أسوأ"}
                      </Badge>
                      بعد 5 سنوات
                    </p>
                    <p className="tnum mt-2 text-2xl font-semibold">
                      {verdict.diff >= 0 ? "+" : "−"}{formatEGP(Math.abs(verdict.diff))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      مقابل {formatEGP(verdict.baseLast.closingBalance)} إذا لم يتغير شيء.
                    </p>
                    {verdict.survival && <p className="mt-2 text-warning">{verdict.survival}</p>}
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">فحص المخاطر</p>
                    {verdict.firstDanger ? (
                      <p className="mt-1.5 text-destructive">
                        هذا المسار يدخل منطقة خطر في {verdict.firstDanger.label} (الرصيد {formatEGP(verdict.firstDanger.minBalance)}).
                        {!verdict.baseDanger && " مسارك الحالي لا يدخلها — هذا القرار هو من يصنع المخاطرة."}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-primary">لا مناطق خطر على هذا المسار خلال 5 سنوات.</p>
                    )}
                    {kind === "loan" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        القسط يساوي {((monthlyLoanPayment / Math.max(profile.monthlyIncome, 1)) * 100).toFixed(0)}% من دخلك الشهري.
                        {monthlyLoanPayment / Math.max(profile.monthlyIncome, 1) > 0.3 && " تجاوز 30% يعتبر عموماً استدانة مفرطة."}
                      </p>
                    )}
                    {kind === "invest" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        العوائد المعروضة توقعات بمعدل {invest.annualReturnPct}% سنوياً وليست ضماناً. خط الكاش يوضح سيولتك أثناء الاستثمار.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
