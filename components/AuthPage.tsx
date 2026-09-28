import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const credentialsSchema = z.object({
  email: z.string().email("أدخل بريداً إلكترونياً صحيحاً"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});
type Credentials = z.infer<typeof credentialsSchema>;

const resetSchema = z.object({
  email: z.string().email("أدخل بريداً إلكترونياً صحيحاً"),
});
type ResetForm = z.infer<typeof resetSchema>;

const ARABIC_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, "بيانات الدخول غير صحيحة"],
  [/email not confirmed/i, "يرجى تأكيد بريدك الإلكتروني من رابط التفعيل أولاً"],
  [/user already registered/i, "هذا البريد مسجّل بالفعل — سجّل الدخول بدلاً من إنشاء حساب"],
  [/password.*(?:short|6 characters)/i, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"],
  [/(?:rate limit|too many requests)/i, "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة"],
  [/(?:fetch failed|network|failed to fetch)/i, "تعذّر الاتصال بالخادم — تحقق من الإنترنت ومن إعدادات Supabase"],
  [/(?:invalid.*email|email.*invalid)/i, "صيغة البريد الإلكتروني غير صحيحة"],
];

function arabicError(message: string): string {
  for (const [pattern, arabic] of ARABIC_ERRORS) {
    if (pattern.test(message)) return arabic;
  }
  return "حدث خطأ غير متوقع — حاول مرة أخرى";
}

function NotConfigured() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الإعداد مطلوب</CardTitle>
        <CardDescription>لم يتم إعداد Supabase بعد.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm text-muted-foreground">
        <p>أضف بيانات مشروعك في ملف <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">.env.local</code>:</p>
        <pre dir="ltr" className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">
{`VITE_SUPABASE_URL=<رابط مشروعك>
VITE_SUPABASE_ANON_KEY=<المفتاح anon>`}
        </pre>
        <p>ثم أعد تشغيل خادم التطوير.</p>
      </CardContent>
    </Card>
  );
}

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [forgot, setForgot] = useState(false);
  const [pending, setPending] = useState(false);

  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });
  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Credentials) {
    if (!supabase) return;
    setPending(true);
    try {
      const { error } =
        mode === "signup"
          ? await supabase.auth.signUp({ email: values.email, password: values.password })
          : await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
      if (error) {
        toast.error(arabicError(error.message));
        return;
      }
      if (mode === "signup") {
        toast.success("تم إنشاء الحساب — سجّل الدخول الآن", { description: "إذا فعّل المشروع تأكيد البريد، فتحقق من بريدك أولاً." });
        setMode("login");
      } else {
        toast.success("أهلاً بعودتك");
      }
      // Navigation happens automatically via onAuthStateChange.
    } finally {
      setPending(false);
    }
  }

  async function onReset(values: ResetForm) {
    if (!supabase) return;
    setPending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast.error(arabicError(error.message));
        return;
      }
      toast.success("إن كان البريد مسجّلاً فسيصله رابط إعادة تعيين كلمة المرور");
      setForgot(false);
    } finally {
      setPending(false);
    }
  }

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main dir="rtl" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
        <NotConfigured />
      </main>
    );
  }

  return (
    <main dir="rtl" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="grid gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-primary">مسار</span> · خريطتك المالية
        </h1>
        <p className="text-sm text-muted-foreground">سجّل الدخول للوصول إلى محاكيك المالي</p>
      </header>

      <Card>
        <CardHeader>
          <Tabs value={forgot ? "reset" : mode} onValueChange={(v) => { setForgot(false); setMode(v as "login" | "signup"); }}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1" onClick={() => setForgot(false)}>تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1" onClick={() => setForgot(false)}>حساب جديد</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {!forgot ? (
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    className="pr-9 text-left"
                    placeholder="you@example.com"
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p role="alert" className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="pr-9 text-left"
                    placeholder="••••••"
                    {...form.register("password")}
                  />
                </div>
                {form.formState.errors.password && (
                  <p role="alert" className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {mode === "signup" ? "إنشاء الحساب" : "دخول"}
              </Button>
              <button
                type="button"
                className="justify-self-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setForgot(true)}
              >
                نسيت كلمة المرور؟
              </button>
            </form>
          ) : (
            <form onSubmit={resetForm.handleSubmit(onReset)} className="grid gap-4" noValidate>
              <CardDescription>
                أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
              </CardDescription>
              <div className="grid gap-2">
                <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                <Input
                  id="reset-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  className="text-left"
                  placeholder="you@example.com"
                  {...resetForm.register("email")}
                />
                {resetForm.formState.errors.email && (
                  <p role="alert" className="text-xs text-destructive">{resetForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                إرسال رابط الاستعادة
              </Button>
              <button
                type="button"
                className="justify-self-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setForgot(false)}
              >
                العودة لتسجيل الدخول
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        خصوصيتك أولاً — لا نشارك أي مبالغ، ونسب الإنفاق تُشارك مجهّلة فقط.
      </p>
    </main>
  );
}
