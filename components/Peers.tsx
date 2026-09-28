import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Insights, Profile } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { categorySharesForComparison, formatEGP, incomeBand } from "@/lib/engine";
import { getPeerId, loadPeerOptIn, savePeerOptIn } from "@/lib/storage";

const BAND_LABELS: Record<string, string> = {
  "under-10k": "أقل من 10 آلاف ج.م",
  "10k-20k": "10–20 ألف ج.م",
  "20k-40k": "20–40 ألف ج.م",
  "40k-80k": "40–80 ألف ج.م",
  "80k-plus": "أكثر من 80 ألف ج.م",
};

// Clearly-labeled sample benchmark used when the cloud service has no data yet.
const SAMPLE_BENCHMARK: Record<string, number> = {
  housing: 30,
  food: 22,
  dining: 12,
  transport: 10,
  loans: 10,
  subscriptions: 4,
  other: 12,
};

interface BenchmarkResponse {
  ok: boolean;
  band?: string;
  sampleSize?: number;
  averages?: Record<string, number>;
  source?: "cloud" | "sample";
}

async function fetchBenchmark(band: string): Promise<BenchmarkResponse> {
  try {
    const res = await fetch(`/functions/v1/app?action=benchmark&band=${encodeURIComponent(band)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as BenchmarkResponse;
    if (data.ok && data.averages && (data.sampleSize ?? 0) > 0) {
      return { ...data, source: "cloud" };
    }
    throw new Error("no cloud data yet");
  } catch {
    return { ok: true, band, averages: SAMPLE_BENCHMARK, sampleSize: 0, source: "sample" };
  }
}

async function contribute(band: string, shares: Record<string, number>): Promise<boolean> {
  try {
    const res = await fetch("/functions/v1/app?action=contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId: getPeerId(), band, shares }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function Peers({ profile, insights }: { profile: Profile; insights: Insights }) {
  const band = incomeBand(profile.monthlyIncome);
  const [optIn, setOptIn] = useState(loadPeerOptIn());
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [contributed, setContributed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBenchmark(band).then((b) => { if (!cancelled) setBenchmark(b); });
    return () => { cancelled = true; };
  }, [band]);

  const myShares = useMemo(() => categorySharesForComparison(insights), [insights]);

  useEffect(() => {
    if (!optIn) return;
    let cancelled = false;
    contribute(band, myShares).then((ok) => { if (!cancelled) setContributed(ok); });
    return () => { cancelled = true; };
  }, [optIn, band, myShares]);

  function toggleOptIn(next: boolean) {
    setOptIn(next);
    savePeerOptIn(next);
    if (!next) setContributed(null);
  }

  const rows = [...new Set([...Object.keys(myShares), ...Object.keys(benchmark?.averages ?? {})])]
    .map((cat) => ({
      category: cat,
      mine: myShares[cat] ?? 0,
      peers: benchmark?.averages?.[cat] ?? 0,
    }))
    .sort((a, b) => b.mine - a.mine || b.peers - a.peers);

  const isSample = benchmark?.source !== "cloud";
  const biggestGap = rows
    .map((r) => ({ ...r, gap: r.mine - r.peers }))
    .sort((a, b) => b.gap - a.gap)[0];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1.5">
              <CardTitle>أشباهك في الدخل ({BAND_LABELS[band]}/شهر)</CardTitle>
              <CardDescription>
                نسبة كل فئة من الدخل الشهري — أنت مقابل أقران مجهولين في نفس شريحة دخلك.
              </CardDescription>
            </div>
            {benchmark && (
              <Badge variant="outline" className="text-muted-foreground">
                {isSample
                  ? `بيانات نموذجية — ساهم ${benchmark.sampleSize ?? 0} مستخدم حتى الآن`
                  : `حيّة · ${benchmark.sampleSize} مستخدم مجهول`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {isSample && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              {benchmark && (benchmark.sampleSize ?? 0) > 0
                ? `ساهم ${benchmark.sampleSize} مستخدم فقط حتى الآن، لذا هذه أرقام نموذجية توضيحية وليست متوسطات حقيقية بعد. مع مشاركة المزيد تُستبدل بمتوسطات الأقران الحقيقية تلقائياً.`
                : "أنت من الأوائل — لم يشارك أحد بياناته المجهلة بعد، لذا هذه أرقام نموذجية توضيحية. مع مشاركة المزيد تُستبدل بمتوسطات الأقران الحقيقية تلقائياً."}
            </p>
          )}
          <div className="grid gap-3">
            {rows.map((r) => {
              const max = Math.max(r.mine, r.peers, 1);
              return (
                <div key={r.category} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category}</span>
                    <span className="tnum text-xs text-muted-foreground">
                      أنت {r.mine.toFixed(0)}% · الأقران {r.peers.toFixed(0)}%
                    </span>
                  </div>
                  <div className="grid gap-1" role="img" aria-label={`${CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category}: أنت ${r.mine.toFixed(0)}% من دخلك، الأقران ${r.peers.toFixed(0)}%`}>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${r.mine > r.peers * 1.2 ? "bg-destructive/80" : "bg-primary"}`}
                        style={{ width: `${(r.mine / max) * 100}%` }}
                      />
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-2/70" style={{ width: `${(r.peers / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {biggestGap && biggestGap.gap > 3 && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              أصحاب الدخل المشابه لدخلك ينفقون{" "}
              <strong className="tnum">{biggestGap.peers.toFixed(0)}%</strong> على{" "}
              {(CATEGORY_LABELS[biggestGap.category as keyof typeof CATEGORY_LABELS] ?? biggestGap.category)}، بينما أنت تنفق{" "}
              <strong className="tnum text-destructive">{biggestGap.mine.toFixed(0)}%</strong>. الاقتراب من نسبة الأقران يحرر لك حوالي{" "}
              <strong className="tnum">{formatEGP(((biggestGap.gap / 100) * profile.monthlyIncome))}</strong> شهرياً.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">المشاركة المجهّلة</CardTitle>
          <CardDescription>
            ساعد في بناء مؤشرات حقيقية للجميع. تُشارك فقط شريحة دخلك والنسب المئوية للفئات — أبداً لا مبالغ ولا أسماء ولا أرصدة ولا فواتير. يمكنك الإيقاف في أي وقت.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch id="peer-optin" checked={optIn} onCheckedChange={toggleOptIn} />
            <Label htmlFor="peer-optin">
              {optIn ? "أشارك نسب فئاتي مجهّلة" : "لا أشارك حالياً"}
            </Label>
            {contributed === true && <Badge className="bg-primary/15 text-primary hover:bg-primary/15">تم إرسال مساهمتك</Badge>}
            {contributed === false && <Badge variant="outline" className="text-muted-foreground">الخدمة السحابية غير متاحة — سنعيد المحاولة لاحقاً</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
