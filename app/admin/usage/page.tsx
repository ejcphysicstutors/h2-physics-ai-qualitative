import Link from "next/link";
import { Activity, ExternalLink, ShieldCheck } from "lucide-react";
import { getUsageSummary } from "@/lib/posthog-admin";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  evidence_asked: "Ask searches",
  evidence_inspected: "Evidence inspected",
  source_opened: "Original sources opened",
  ask_record_opened_in_explorer: "Ask → Explorer transitions",
  teacher_interpretation_viewed: "Teaching interpretations opened",
  feedback_submitted: "Feedback submitted",
};

const durationLabels: Record<string, string> = {
  under_30s: "Under 30 s",
  "30s_to_2m": "30 s–2 min",
  "2m_to_5m": "2–5 min",
  "5m_to_15m": "5–15 min",
  "15m_plus": "15+ min",
};

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p></div>;
}

function Bars({ rows }: { rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="text-sm text-slate-500">No tracked data yet.</p>;
  return <div className="space-y-3">{rows.map((row) => <div key={row.label}><div className="flex justify-between gap-4 text-sm"><span className="truncate">{row.label}</span><strong>{row.count}</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-700" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} /></div></div>)}</div>;
}

export default async function UsagePage() {
  const summary = await getUsageSummary(30);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-teal-800">← Admin</Link>
            <div className="mt-5 flex items-center gap-2"><Activity className="h-5 w-5 text-teal-800" /><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Last 30 days</p></div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Usage analytics</h1>
            <p className="mt-2 text-slate-600">Privacy-safe product analytics from PostHog. Basic visitor/page traffic remains in Vercel Analytics.</p>
          </div>
          <a href="https://app.posthog.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Open PostHog <ExternalLink className="h-4 w-4" /></a>
        </div>

        {!summary.configured ? (
          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold">PostHog event capture can be enabled independently</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">This dashboard needs server-side read credentials before it can display aggregate usage. Add <code>POSTHOG_PROJECT_ID</code> and <code>POSTHOG_PERSONAL_API_KEY</code> in Vercel. Event capture is configured separately with the server-side <code>POSTHOG_PROJECT_KEY</code>.</p>
          </section>
        ) : summary.error ? (
          <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-semibold">PostHog is configured but the dashboard query failed</h2><p className="mt-2 text-sm text-slate-700">{summary.error}</p></section>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Ask searches" value={summary.eventCounts.evidence_asked || 0} />
              <Stat label="Evidence inspected" value={summary.eventCounts.evidence_inspected || 0} />
              <Stat label="Original sources opened" value={summary.eventCounts.source_opened || 0} />
              <Stat label="Ask → Explorer" value={summary.eventCounts.ask_record_opened_in_explorer || 0} />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Most explored topics</h2><p className="mt-1 mb-5 text-sm text-slate-500">From explicit topic selections only.</p><Bars rows={summary.topTopics.map((x) => ({ label: x.topic, count: x.count }))} /></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Session duration bands</h2><p className="mt-1 mb-5 text-sm text-slate-500">Broad engagement bands; exact browsing histories are not stored.</p><Bars rows={summary.durations.map((x) => ({ label: durationLabels[x.duration] || x.duration, count: x.count }))} /></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Answer usefulness</h2><p className="mt-1 mb-5 text-sm text-slate-500">Yes / Partly / No ratings.</p><Bars rows={summary.ratings.map((x) => ({ label: x.rating, count: x.count }))} /></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Tracked actions</h2><p className="mt-1 mb-5 text-sm text-slate-500">Selected high-value actions.</p><Bars rows={Object.entries(labels).map(([key, label]) => ({ label, count: summary.eventCounts[key] || 0 }))} /></div>
            </section>
          </>
        )}

        <div className="mt-8 flex gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Privacy boundary:</strong> No PostHog browser SDK is loaded. Events are forwarded server-side only after allow-list validation, with no persistent user identifier or person profile. No full teacher questions, free-text searches, names, emails or free-text feedback are included.</p></div>
      </div>
    </main>
  );
}
