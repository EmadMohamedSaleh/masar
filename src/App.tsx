import { useMemo, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthProvider, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Onboarding } from "@/components/Onboarding";
import { Overview } from "@/components/Overview";
import { TimeBox } from "@/components/TimeBox";
import { WhatIf } from "@/components/WhatIf";
import { Warnings } from "@/components/Warnings";
import { Peers } from "@/components/Peers";
import { AuthPage } from "@/components/AuthPage";
import type { Profile } from "@/lib/types";
import { buildInsights, dailyBalances, findWarning, buildPlan, simulate, formatEGP } from "@/lib/engine";
import { loadProfile, saveProfile } from "@/lib/storage";

type View = "overview" | "timebox" | "whatif" | "warnings" | "peers";

const TABS: { value: View; label: string }[] = [
  { value: "overview", label: "التوأم الرقمي" },
  { value: "timebox", label: "الصندوق الزمني" },
  { value: "whatif", label: "محاكي القرارات" },
  { value: "warnings", label: "التحذيرات" },
  { value: "peers", label: "الأقران" },
];

function MasarApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<View>("overview");

  const model = useMemo(() => {
    if (!profile) return null;
    const insights = buildInsights(profile);
    const points = simulate(profile, 60);
    const daily = dailyBalances(profile, 90);
    const warning = findWarning(profile, 90);
    const plan = warning ? buildPlan(profile, warning) : [];
    return { insights, points, daily, warning, plan };
  }, [profile]);

  async function logout() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("تعذّر تسجيل الخروج — حاول مرة أخرى");
      return;
    }
    navigate("/auth", { replace: true });
  }

  function completeOnboarding(next: Profile) {
    saveProfile(next);
    setProfile(next);
    setEditing(false);
  }

  if (!profile || editing || !model) {
    return (
      <div dir="rtl">
        <Onboarding initial={profile} onComplete={completeOnboarding} />
      </div>
    );
  }

  const { insights, points, daily, warning, plan } = model;

  return (
    <div dir="rtl" className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              <span className="text-primary">مسار</span> <span className="hidden text-muted-foreground sm:inline">· خريطتك المالية</span>
            </h1>
            {warning ? (
              <button
                onClick={() => setView("warnings")}
                className="tnum rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive underline-offset-2 hover:underline"
              >
                ⚠ عجز {formatEGP(warning.shortfall)} خلال {warning.daysAhead} يوم
              </button>
            ) : (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">لا أزمات خلال 90 يوماً</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="tnum hidden text-sm text-muted-foreground md:inline" dir="ltr">
              {user?.email}
            </span>
            <span className="tnum hidden text-sm text-muted-foreground lg:inline">
              الرصيد {formatEGP(profile.startingBalance)} · الصافي {insights.netMonthly >= 0 ? "+" : "−"}{formatEGP(Math.abs(insights.netMonthly))}/شهر
            </span>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              تعديل البيانات
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-4" aria-hidden />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mb-5">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-accent data-[state=active]:text-foreground">
                {t.label}
                {t.value === "warnings" && warning && <span className="mr-1.5 size-1.5 rounded-full bg-destructive" aria-hidden />}
                {t.value === "timebox" && insights.firstDanger && !warning && <span className="mr-1.5 size-1.5 rounded-full bg-warning" aria-hidden />}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {view === "overview" && <Overview profile={profile} insights={insights} />}
        {view === "timebox" && <TimeBox profile={profile} points={points} insights={insights} />}
        {view === "whatif" && <WhatIf profile={profile} baseline={points} />}
        {view === "warnings" && <Warnings profile={profile} warning={warning} plan={plan} daily={daily} />}
        {view === "peers" && <Peers profile={profile} insights={insights} />}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
        <p className="text-xs text-muted-foreground">
          خصوصيتك أولاً — بياناتك المالية تبقى في متصفحك حتى المرحلة القادمة، ولا تُشارك مع الآخرين إلا نسب الإنفاق المجهّلة التي تختار مشاركتها.
        </p>
      </footer>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        جارٍ التحقق من الجلسة…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        جارٍ التحقق من الجلسة…
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MasarApp />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster theme="dark" position="top-center" dir="rtl" />
      </AuthProvider>
    </BrowserRouter>
  );
}
