import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import type { Category, FixedExpense, IncomingFund, Profile, VariableExpense } from "@/lib/types";
import { CATEGORY_LABELS, FIXED_CATEGORIES, VARIABLE_CATEGORIES } from "@/lib/types";
import { formatEGP } from "@/lib/engine";
import { supabase } from "@/lib/supabase";

function uid(): string {
  return crypto.randomUUID();
}

const STEPS = ["تدفقك النقدي", "المصروفات الثابتة", "الإنفاق المتغير", "أموال قادمة", "المراجعة"] as const;

interface Props {
  initial: Profile | null;
  onComplete: (profile: Profile) => void;
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          dir="ltr"
          className="tnum pl-14 text-right"
          value={value !== 0 ? String(value) : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        />
        {suffix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function Onboarding({ initial, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [startingBalance, setStartingBalance] = useState(initial?.startingBalance ?? 0);
  const [monthlyIncome, setMonthlyIncome] = useState(initial?.monthlyIncome ?? 0);
  const [payday, setPayday] = useState(initial?.payday ?? 1);
  const [safetyBuffer, setSafetyBuffer] = useState(initial?.safetyBuffer ?? 0);
  const [fixed, setFixed] = useState<FixedExpense[]>(
    initial?.fixed ?? [
      { id: uid(), name: "الإيجار", amount: 0, category: "housing", dueDay: 1 },
    ],
  );
  const [variable, setVariable] = useState<VariableExpense[]>(
    initial?.variable ?? [
      { id: uid(), name: "البقالة", amount: 0, category: "food" },
      { id: uid(), name: "الأكل خارج البيت", amount: 0, category: "dining" },
      { id: uid(), name: "المواصلات", amount: 0, category: "transport" },
    ],
  );
  const [incoming, setIncoming] = useState<IncomingFund[]>(initial?.incoming ?? []);

  const totalFixed = fixed.reduce((s, f) => s + f.amount, 0);
  const totalVariable = variable.reduce((s, v) => s + v.amount, 0);
  const net = monthlyIncome - totalFixed - totalVariable;

  function finish() {
    onComplete({
      startingBalance,
      monthlyIncome,
      payday,
      safetyBuffer,
      fixed,
      variable,
      incoming,
      updatedAt: new Date().toISOString(),
    });
  }

  const canAdvance =
    step === 0 ? monthlyIncome > 0 : step === 1 ? totalFixed > 0 : step === 2 ? totalVariable > 0 : true;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="grid gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">ابنِ توأمك الرقمي</h1>
            {initial && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={async () => {
                  if (supabase) {
                    const { error } = await supabase.auth.signOut();
                    if (error) toast.error("تعذّر تسجيل الخروج — حاول مرة أخرى");
                  }
                }}
              >
                <LogOut className="size-4" aria-hidden />
                خروج
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground">خطوة {step + 1} من {STEPS.length} · ~5 دقائق</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
        <p className="text-sm text-muted-foreground">{STEPS[step]}</p>
      </header>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>تدفقك النقدي الشهري</CardTitle>
            <CardDescription>ما يدخل حسابك، وما تملكه الآن، ومتى ينزل الراتب.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <NumberField label="الدخل الشهري (راتب، معاش…)" value={monthlyIncome} onChange={setMonthlyIncome} suffix="ج.م" />
            <NumberField label="رصيدك الحالي في حساباتك" value={startingBalance} onChange={setStartingBalance} suffix="ج.م" />
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="payday">يوم نزول الراتب</Label>
                <NativeSelect id="payday" value={String(payday)} onChange={(e) => setPayday(Number(e.target.value))}>
                  {Array.from({ length: 28 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </NativeSelect>
              </div>
              <NumberField label="حد الخطر (أقل من هذا الرصيد = أحمر)" value={safetyBuffer} onChange={setSafetyBuffer} suffix="ج.م" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>المصروفات الثابتة</CardTitle>
            <CardDescription>الفواتير التي تنزل في يوم معروف كل شهر — الإيجار، الأقساط، الاشتراكات.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {fixed.map((item, i) => (
              <div key={item.id} className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[1fr_140px_150px_70px_36px] sm:items-end">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`fx-name-${item.id}`}>الاسم</Label>
                  <Input
                    id={`fx-name-${item.id}`}
                    value={item.name}
                    onChange={(e) => setFixed(fixed.map((f, j) => (j === i ? { ...f, name: e.target.value } : f)))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`fx-amt-${item.id}`}>المبلغ (ج.م)</Label>
                  <Input
                    id={`fx-amt-${item.id}`}
                    type="number" min={0} dir="ltr" className="tnum text-right"
                    value={item.amount || ""}
                    placeholder="0"
                    onChange={(e) => setFixed(fixed.map((f, j) => (j === i ? { ...f, amount: Math.max(0, Number(e.target.value) || 0) } : f)))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`fx-cat-${item.id}`}>الفئة</Label>
                  <NativeSelect
                    id={`fx-cat-${item.id}`}
                    value={item.category}
                    onChange={(e) => setFixed(fixed.map((f, j) => (j === i ? { ...f, category: e.target.value as Category } : f)))}
                  >
                    {FIXED_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`fx-day-${item.id}`}>يوم الاستحقاق</Label>
                  <NativeSelect
                    id={`fx-day-${item.id}`}
                    value={String(item.dueDay)}
                    onChange={(e) => setFixed(fixed.map((f, j) => (j === i ? { ...f, dueDay: Number(e.target.value) } : f)))}
                  >
                    {Array.from({ length: 28 }, (_, d) => <option key={d + 1} value={d + 1}>{d + 1}</option>)}
                  </NativeSelect>
                </div>
                <Button
                  variant="ghost" size="icon" aria-label={`إزالة ${item.name}`}
                  onClick={() => setFixed(fixed.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >✕</Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setFixed([...fixed, { id: uid(), name: "", amount: 0, category: "other", dueDay: 1 }])}>
                + أضف فاتورة
              </Button>
              <p className="tnum text-sm text-muted-foreground">الإجمالي: <span className="font-medium text-foreground">{formatEGP(totalFixed)}</span>/شهر</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>الإنفاق المتغير</CardTitle>
            <CardDescription>تقديرات شهرية تقريبية تكفي — المحرك يتعلم من عاداتك هذه.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {variable.map((item, i) => (
              <div key={item.id} className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[1fr_140px_150px_36px] sm:items-end">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`vr-name-${item.id}`}>الاسم</Label>
                  <Input
                    id={`vr-name-${item.id}`}
                    value={item.name}
                    onChange={(e) => setVariable(variable.map((f, j) => (j === i ? { ...f, name: e.target.value } : f)))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`vr-amt-${item.id}`}>شهرياً (ج.م)</Label>
                  <Input
                    id={`vr-amt-${item.id}`}
                    type="number" min={0} dir="ltr" className="tnum text-right"
                    value={item.amount || ""}
                    placeholder="0"
                    onChange={(e) => setVariable(variable.map((f, j) => (j === i ? { ...f, amount: Math.max(0, Number(e.target.value) || 0) } : f)))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`vr-cat-${item.id}`}>الفئة</Label>
                  <NativeSelect
                    id={`vr-cat-${item.id}`}
                    value={item.category}
                    onChange={(e) => setVariable(variable.map((f, j) => (j === i ? { ...f, category: e.target.value as Category } : f)))}
                  >
                    {VARIABLE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </NativeSelect>
                </div>
                <Button
                  variant="ghost" size="icon" aria-label={`إزالة ${item.name}`}
                  onClick={() => setVariable(variable.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >✕</Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setVariable([...variable, { id: uid(), name: "", amount: 0, category: "other" }])}>
                + أضف بند إنفاق
              </Button>
              <p className="tnum text-sm text-muted-foreground">الإجمالي: <span className="font-medium text-foreground">{formatEGP(totalVariable)}</span>/شهر</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>أموال قادمة</CardTitle>
            <CardDescription>مكافآت، دخل جانبي، هدايا — أي شيء غير الراتب. اختيارية لكنها تجعل التوأم أدق.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {incoming.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                لا شيء مضاف بعد. إذا كنت تتوقع مكافأة أو دخلاً جانبياً أضفه هنا — وإلا انتقل للخطوة التالية.
              </p>
            )}
            {incoming.map((item, i) => (
              <div key={item.id} className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[1fr_140px_130px_130px_36px] sm:items-end">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`in-name-${item.id}`}>الاسم</Label>
                  <Input
                    id={`in-name-${item.id}`}
                    value={item.name}
                    placeholder="مثال: مكافأة سنوية"
                    onChange={(e) => setIncoming(incoming.map((f, j) => (j === i ? { ...f, name: e.target.value } : f)))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`in-amt-${item.id}`}>المبلغ (ج.م)</Label>
                  <Input
                    id={`in-amt-${item.id}`}
                    type="number" min={0} dir="ltr" className="tnum text-right"
                    value={item.amount || ""}
                    placeholder="0"
                    onChange={(e) => setIncoming(incoming.map((f, j) => (j === i ? { ...f, amount: Math.max(0, Number(e.target.value) || 0) } : f)))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`in-kind-${item.id}`}>التكرار</Label>
                  <NativeSelect
                    id={`in-kind-${item.id}`}
                    value={item.kind}
                    onChange={(e) => setIncoming(incoming.map((f, j) => (j === i ? { ...f, kind: e.target.value as "once" | "annual", inMonths: e.target.value === "annual" ? Math.min(f.inMonths, 11) : f.inMonths } : f)))}
                  >
                    <option value="once">مرة واحدة</option>
                    <option value="annual">كل سنة</option>
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`in-when-${item.id}`}>
                    {item.kind === "once" ? "تصل بعد (شهور)" : "أول وصول بعد (شهور)"}
                  </Label>
                  <Input
                    id={`in-when-${item.id}`}
                    type="number" min={0} max={item.kind === "annual" ? 11 : 120} dir="ltr" className="tnum text-right"
                    value={String(item.inMonths)}
                    onChange={(e) => setIncoming(incoming.map((f, j) => (j === i ? { ...f, inMonths: Math.max(0, Number(e.target.value) || 0) } : f)))}
                  />
                </div>
                <Button
                  variant="ghost" size="icon" aria-label={`إزالة ${item.name}`}
                  onClick={() => setIncoming(incoming.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >✕</Button>
              </div>
            ))}
            <Button variant="outline" className="justify-self-start" onClick={() => setIncoming([...incoming, { id: uid(), name: "", amount: 0, kind: "once", inMonths: 1 }])}>
              + أضف أموالاً قادمة
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>راجع توأمك</CardTitle>
            <CardDescription>كل بياناتك خاصة في متصفحك. يمكنك تعديل أي منها لاحقاً.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">الدخل الشهري</span><span className="tnum font-medium">{formatEGP(monthlyIncome)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">الرصيد الحالي</span><span className="tnum font-medium">{formatEGP(startingBalance)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">مصروفات ثابتة ({fixed.length})</span><span className="tnum font-medium">−{formatEGP(totalFixed)}/شهر</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">إنفاق متغير ({variable.length})</span><span className="tnum font-medium">−{formatEGP(totalVariable)}/شهر</span></div>
            {incoming.length > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">أموال قادمة ({incoming.length})</span><span className="tnum font-medium">{incoming.map((f) => f.name || formatEGP(f.amount)).join("، ")}</span></div>
            )}
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-medium">الصافي الشهري المتوقع</span>
              <span className={`tnum font-semibold ${net >= 0 ? "text-primary" : "text-destructive"}`}>
                {net >= 0 ? "+" : "−"}{formatEGP(Math.abs(net))}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {net >= 0
                ? "أنت تنفق أقل مما تكسب. الصندوق الزمني سيوضح إلى أي مدى سيحمل هذا الفائض."
                : "أنت تنفق أكثر مما تكسب. المحاكاة ستريك متى تتحول هذه لمشكلة — ومحاكي القرارات يساعدك في إصلاحها."}
            </p>
          </CardContent>
        </Card>
      )}

      <nav className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          رجوع
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canAdvance}>
            متابعة
          </Button>
        ) : (
          <Button onClick={finish} disabled={monthlyIncome <= 0}>
            ابدأ المحاكاة
          </Button>
        )}
      </nav>
    </main>
  );
}
