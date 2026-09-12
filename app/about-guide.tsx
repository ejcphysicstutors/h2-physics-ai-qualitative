import { Search, FileSearch, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, BookOpen, Layers3, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const steps=[
  {n:"1",title:"Start with the task",text:"Choose whether you need a synthesis or whether you want to inspect the evidence yourself."},
  {n:"2",title:"Check the source layer",text:"Distinguish current 9478 syllabus evidence, 9749 examiner reports and historical 9702 precedent."},
  {n:"3",title:"Make the judgement",text:"Use the evidence strength, provenance and corpus limitations when deciding what to teach, set or credit."}
];

export default function AboutGuide(){
  return <section className="space-y-7">
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.17em] text-teal-700">Teacher guide</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">How to use the Evidence Hub</h2>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">The Hub has two complementary workspaces. Use <strong>Ask the Evidence</strong> when you need a source-grounded synthesis. Use <strong>Evidence Explorer</strong> when you want to browse, verify, compare or collect the underlying records yourself.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">{steps.map(s=><div key={s.n} className="rounded-2xl border bg-slate-50 p-4"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#071a2d] text-sm font-bold text-white">{s.n}</span><h3 className="mt-3 font-semibold">{s.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{s.text}</p></div>)}</div>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-[26px] border border-teal-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-teal-100 p-2 text-teal-800"><Search className="h-5 w-5"/></span><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Tab 1</p><h3 className="text-xl font-semibold">Ask the Evidence</h3></div></div>
        <p className="mt-4 leading-7 text-slate-600">Use this when you have a question or need to make an assessment judgement. The Hub retrieves relevant records, separates the evidence layers and produces a cautious synthesis.</p>
        <div className="mt-5 rounded-2xl bg-teal-50 p-4"><p className="text-sm font-semibold text-teal-900">Best for</p><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700"><li>• Checking whether particular wording is essential</li><li>• Understanding recurrent candidate difficulties</li><li>• Comparing accepted alternatives and explicit rejects</li><li>• Informing mark-scheme writing or vetting</li></ul></div>
        <div className="mt-4"><p className="text-sm font-semibold">Example questions</p><ul className="mt-2 space-y-2 text-sm text-slate-600"><li>“Does Cambridge require the word superposition?”</li><li>“What mistakes do candidates make when defining electric potential?”</li><li>“What wording appears consistently acceptable?”</li></ul></div>
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="h-5 w-5 shrink-0"/><p>The synthesis supports teacher judgement; it does not replace checking the cited records.</p></div>
      </article>

      <article className="rounded-[26px] border border-indigo-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-100 p-2 text-indigo-800"><FileSearch className="h-5 w-5"/></span><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Tab 2</p><h3 className="text-xl font-semibold">Evidence Explorer</h3></div></div>
        <p className="mt-4 leading-7 text-slate-600">Use this when you want to see exactly what evidence is available and verify it independently. The Explorer does not generate a large synthesis; it keeps the records and their sources in view.</p>
        <div className="mt-5 rounded-2xl bg-indigo-50 p-4"><p className="text-sm font-semibold text-indigo-950">Normal workflow</p><div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-900"><Badge variant="outline">Filter</Badge><ArrowRight className="h-3 w-3"/><Badge variant="outline">Browse</Badge><ArrowRight className="h-3 w-3"/><Badge variant="outline">Inspect</Badge><ArrowRight className="h-3 w-3"/><Badge variant="outline">Verify</Badge><ArrowRight className="h-3 w-3"/><Badge variant="outline">Compare</Badge><ArrowRight className="h-3 w-3"/><Badge variant="outline">Collect</Badge></div></div>
        <div className="mt-4"><p className="text-sm font-semibold">What you can do</p><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600"><li>• Filter by topic, source, category, year and paper</li><li>• Read the structured extraction and its classification separately</li><li>• Open the available original ER and related question paper</li><li>• Compare evidence across years without assuming consistency</li><li>• Send selected records to Tab 1 for constrained synthesis</li></ul></div>
      </article>
    </div>

    <article className="rounded-[26px] border bg-[#071a2d] p-6 text-white sm:p-8">
      <div className="flex items-center gap-3"><Layers3 className="h-6 w-6 text-cyan-300"/><h3 className="text-xl font-semibold">Know which layer you are reading</h3></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-sky-400/30 bg-white/5 p-4"><BookOpen className="h-5 w-5 text-sky-300"/><h4 className="mt-3 font-semibold">Cambridge source evidence</h4><p className="mt-1 text-sm leading-6 text-slate-300">Extracted QP, MS, examiner-report or syllabus content tied to a citation.</p></div>
        <div className="rounded-2xl border border-violet-400/30 bg-white/5 p-4"><ShieldCheck className="h-5 w-5 text-violet-300"/><h4 className="mt-3 font-semibold">Database classification</h4><p className="mt-1 text-sm leading-6 text-slate-300">Topic, LO, misconception, category and cross-syllabus mapping used to organise records.</p></div>
        <div className="rounded-2xl border border-teal-400/30 bg-white/5 p-4"><CheckCircle2 className="h-5 w-5 text-teal-300"/><h4 className="mt-3 font-semibold">Teacher interpretation</h4><p className="mt-1 text-sm leading-6 text-slate-300">An optional AI-assisted implication for teaching or assessment, always labelled separately.</p></div>
      </div>
    </article>

    <div className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border bg-white p-5"><h3 className="font-semibold">Understanding relevance</h3><dl className="mt-3 space-y-3 text-sm"><div><dt className="font-semibold text-teal-800">Direct evidence</dt><dd className="text-slate-600">The record directly addresses the concept or assessment issue.</dd></div><div><dt className="font-semibold text-indigo-800">Closely related evidence</dt><dd className="text-slate-600">The record materially helps interpret the issue but is not identical.</dd></div><div><dt className="font-semibold text-amber-800">Contextual evidence</dt><dd className="text-slate-600">Potentially useful background, hidden from default Explorer results.</dd></div></dl></article>
      <article className="rounded-2xl border bg-white p-5"><h3 className="font-semibold">Important evidence boundaries</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><li>• Historical 9702 precedent is not automatically a current 9478 requirement.</li><li>• Absence of an examiner-report comment does not prove that wording was accepted.</li><li>• A single mark scheme establishes precedent for that context, not necessarily a universal rule.</li><li>• Missing or unreadable sources are not reconstructed as verified quotations.</li></ul></article>
    </div>
    <article className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-[#16769d]"/><h3 className="font-semibold">Privacy-respecting usage analytics</h3></div><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">The Hub records aggregate actions such as which tab is used, selected topic, source type, evidence inspection and a broad session-duration band. It does not send names, email addresses, full questions or free-text searches to analytics.</p></article>
  </section>
}
