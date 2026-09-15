import Link from "next/link";
import { Activity, DatabaseZap, ShieldCheck, Wrench } from "lucide-react";

const cards = [
  {
    href: "/admin/usage",
    title: "Usage analytics",
    description: "Privacy-safe teacher usage: Ask, Explorer, topics, source opening, engagement bands and usefulness ratings.",
    icon: Activity,
  },
  {
    href: "/admin/qa",
    title: "Evidence QA",
    description: "Corpus health, source-link coverage, mapping checks and data-quality warnings.",
    icon: DatabaseZap,
  },
];

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-sm font-semibold text-teal-800">← Evidence Hub</Link>
        <div className="mt-6 flex items-start gap-3">
          <div className="rounded-xl bg-teal-100 p-2.5"><Wrench className="h-5 w-5 text-teal-900" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Administration</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Evidence Hub admin</h1>
            <p className="mt-2 max-w-2xl text-slate-600">A single home for operational, QA and usage tools. Future admin tools should be linked here.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {cards.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-300 hover:shadow-md">
              <Icon className="h-5 w-5 text-teal-800" />
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              <p className="mt-5 text-sm font-semibold text-teal-800">Open →</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Privacy boundary:</strong> admin analytics must not display teacher identities, full Ask questions, free-text searches, or free-text feedback comments.</p>
        </div>
      </div>
    </main>
  );
}
