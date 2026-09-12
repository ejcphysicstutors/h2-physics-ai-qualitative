"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ShieldCheck, BookOpen, FileText, ChevronDown, AlertTriangle, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EvidenceExplorer from "@/app/evidence-explorer";
import AboutGuide from "@/app/about-guide";
import { durationBand, recordUsage } from "@/lib/usage-analytics";

const starters = [
  ["Check a marking requirement", "Does Cambridge require the word superposition when explaining interference?"],
  ["Candidate difficulties", "What mistakes do candidates make when describing electric potential?"],
  ["Cambridge precedent", "How has Cambridge marked answers about taking repeated readings and averaging?"],
  ["Question examples", "Find qualitative questions about electromagnetic induction."],
  ["Topic and LO exploration", "What responses have been insufficient when discussing percentage uncertainty?"]
];

const layerStyle:any = {
  governing: {title:"Current 9478 Governing Evidence", icon:ShieldCheck, cls:"border-sky-200 bg-sky-50/70 text-sky-950"},
  examiner: {title:"9749 Examiner Report Evidence", icon:FileText, cls:"border-amber-200 bg-amber-50/70 text-amber-950"},
  precedent: {title:"9702 Cambridge Mark-Scheme Precedent", icon:BookOpen, cls:"border-indigo-200 bg-indigo-50/70 text-indigo-950"}
};

function EvidenceCard({item}:{item:any}) {
  const s=layerStyle[item.layer]; const Icon=s.icon;
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className={s.cls}><Icon className="mr-1 h-3.5 w-3.5"/>{s.title}</Badge><Badge variant="secondary">{item.relevance}</Badge></div>
    <p className="font-semibold text-slate-900">{item.citation}</p>
    {item.topic && <p className="mt-1 text-sm text-slate-600">{item.topic}{item.lo ? ` · ${item.lo}`:""}</p>}
    {item.question && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{item.question}</p>}
    <p className="mt-3 text-[0.95rem] leading-7 text-slate-800">{item.evidence}</p>
    {!!item.accepted?.length && <div className="mt-3"><p className="text-sm font-semibold">Accepted alternatives</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{item.accepted.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>}
    {!!item.rejected?.length && <div className="mt-3"><p className="text-sm font-semibold text-rose-800">Explicit rejects</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{item.rejected.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>}
    {!!item.limits?.length && <div className="mt-3"><p className="text-sm font-semibold text-rose-800">Limit rules</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{item.limits.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>}
    {item.mapping && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600"><strong>9478 mapping:</strong> {item.mapping}</p>}
    <p className="mt-3 text-sm font-medium text-teal-800">Why relevant: {item.reason}</p>
  </article>
}

export default function Home() {
  const [query,setQuery]=useState(starters[0][1]); const [interpret,setInterpret]=useState(false); const [loading,setLoading]=useState(false); const [result,setResult]=useState<any>(null); const [error,setError]=useState(""); const [previousConcept,setPreviousConcept]=useState("");
  const [tab,setTab]=useState("ask"); const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const openedAt=useRef(Date.now());
  const grouped=useMemo(()=>Object.groupBy(result?.supportingEvidence||[],(x:any)=>x.layer),[result]);
  const evidenceSummary=result?.evidenceSummary;
  const relevanceLine=evidenceSummary?[evidenceSummary.directCount&&`${evidenceSummary.directCount} directly relevant`,evidenceSummary.analogousCount&&`${evidenceSummary.analogousCount} closely analogous`,evidenceSummary.backgroundCount&&`${evidenceSummary.backgroundCount} background-only`].filter(Boolean).join(" · "):"";
  const contextLine=evidenceSummary?.verified9478ItemCount>0?`9478 evidence base: ${evidenceSummary.verified9478ItemCount} verified 9478 ${evidenceSummary.verified9478ItemCount===1?"item":"items"} + historical precedent.`:"9478 evidence base: precedent-only — 2026 is this syllabus’s first year.";
  const showClaimTag=(sections:any[],index:number)=>{const current=sections[index]?.claim_class;if(current==="Teacher inference"||current==="Inference from limited precedent"||current==="Not established"||current==="Explicitly rejected or limited")return true;return current!==sections[index-1]?.claim_class&&current!==sections[index+1]?.claim_class};
  useEffect(()=>{const report=()=>recordUsage("session_duration",{duration:durationBand(Math.round((Date.now()-openedAt.current)/1000))});window.addEventListener("pagehide",report,{once:true});return()=>window.removeEventListener("pagehide",report)},[]);
  function changeTab(value:string){setTab(value);recordUsage("tab_viewed",{tab:value})}
  async function ask(q=query){ if(!q.trim())return;recordUsage("evidence_asked",{teacher_interpretation:interpret,constrained:selectedIds.length>0});setLoading(true);setError("");setResult(null); try{const res=await fetch("/api/evidence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,teacherInterpretation:interpret,previousConcept,selectedIds})});const data:any=await res.json();if(!res.ok)throw new Error(data.error||"Evidence search could not be completed.");if(data.needsClarification){setError(data.clarificationQuestion);return;}setResult(data);setPreviousConcept(data.interpretation?.concept||previousConcept)}catch(e:any){setError(e.message)}finally{setLoading(false)}}
  return <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[116rem] flex-wrap items-center justify-between gap-4 px-5 py-3 lg:px-14"><button onClick={()=>changeTab("ask")} className="flex items-center gap-4 text-left"><span className="display-serif inline-flex h-14 w-14 items-center justify-center rounded-lg bg-[#103b59] text-3xl text-white">Φ</span><span><span className="block text-sm text-[#102d46]">Cambridge H2 Physics</span><span className="display-serif block text-xl font-bold text-[#102d46] sm:text-2xl">Assessment Evidence Hub</span></span></button><nav aria-label="Main navigation" className="flex flex-wrap items-center gap-5 lg:gap-9"><button className="nav-link" data-active={tab==="ask"} onClick={()=>changeTab("ask")}>Ask the Evidence</button><button className="nav-link" data-active={tab==="browse"} onClick={()=>changeTab("browse")}>Evidence Explorer</button><button className="nav-link" data-active={tab==="about"} onClick={()=>changeTab("about")}>About &amp; Guide</button></nav></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8">
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsContent value="ask">
          {!!selectedIds.length&&<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-300 bg-teal-50 p-4"><div><strong>Constrained evidence set · {selectedIds.length} selected records</strong><p className="text-sm text-slate-600">This answer will use only the records selected in Evidence Explorer.</p></div><Button variant="outline" onClick={()=>setSelectedIds([])}>Clear selected evidence</Button></div>}
          <section className="full-bleed -mt-8 bg-[#123f5e] text-white">
            <div className="mx-auto max-w-[106rem] px-6 py-14 lg:px-14 lg:py-20"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#73c9ee]">Certified Cambridge evidence · 2009–2025</p><h2 className="display-serif mt-4 text-5xl leading-[1.05] sm:text-7xl">What does the evidence show?</h2><p className="mt-6 max-w-5xl text-lg leading-8 text-slate-100 sm:text-xl">Search examiner observations, official mark-scheme precedent and the current 9478 syllabus. Historical 9702 precedent is never treated as a 9478 requirement.</p>
            <div className="mt-9 flex flex-col rounded-xl bg-white p-2 text-slate-900 shadow-2xl sm:flex-row"><div className="flex min-w-0 flex-1 items-start"><Search className="ml-3 mt-4 h-6 w-6 shrink-0 text-slate-500"/><Textarea value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))ask()}} className="min-h-14 flex-1 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0" aria-label="Question for the evidence"/></div><Button size="lg" onClick={()=>ask()} disabled={loading} className="min-h-14 self-stretch bg-[#efb447] px-8 font-bold text-[#102d46] hover:bg-[#e2a538]">{loading?<><Sparkles className="mr-2 h-4 w-4 animate-pulse"/>Examining…</>:"Search evidence"}</Button></div>
            <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p className="text-sm text-slate-200"><strong className="text-white">205</strong> examiner observations <span className="mx-3">·</span><strong className="text-white">1,934</strong> mark-scheme points <span className="mx-3">·</span><strong className="text-white">20</strong> current 9478 topics</p><label className="flex items-center gap-3 text-sm"><Switch checked={interpret} onCheckedChange={setInterpret}/><span>Evidence + teacher interpretation</span></label></div></div>
          </section>
          {!result&&!loading&&!error&&<div className="grid gap-px overflow-hidden border-x border-b bg-slate-200 sm:grid-cols-2 xl:grid-cols-5">{starters.map(([label,q],index)=><button key={label} onClick={()=>{setQuery(q);ask(q)}} className="min-h-44 bg-white p-6 text-left transition hover:bg-[#f7fbfd]"><span className="display-serif text-sm font-bold text-slate-400">0{index+1}</span><span className="display-serif mt-7 block text-xl font-bold leading-tight text-[#102d46]">{label}</span><span className="mt-2 block text-sm leading-6 text-slate-600">{q}</span></button>)}</div>}
          {error&&<div role="alert" className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="font-semibold">The evidence answer is not available</p><p className="mt-1">{error}</p></div></div>}
          {result&&<section className="mt-8 space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {evidenceSummary?.totalRelevant>0?<><div className="flex flex-wrap items-center gap-2"><Badge className="bg-[#123f5e] text-white">{relevanceLine}</Badge><Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-950">{contextLine}</Badge></div><div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">{result.judgement}</Badge><Badge variant="outline">{result.recurrence}</Badge></div></>:<div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950"><p className="font-semibold">No relevant evidence of any kind was found</p><p className="mt-1 text-sm">The search returned no directly relevant, analogous or background records from the indexed corpus.</p></div>}
              <p className="mt-3 text-sm text-slate-500">Interpreted as <strong>{result.interpretation?.intent}</strong> · {result.interpretation?.concept}</p>
              <div className="mt-6 divide-y divide-slate-100">{result.sections?.map((s:any,index:number)=><div key={s.key} className={s.claim_class==="Teacher inference"?"my-4 rounded-2xl border border-violet-200 bg-violet-50 p-5":s.claim_class==="Inference from limited precedent"?"my-4 rounded-2xl border border-amber-300 bg-amber-50 p-5":"py-5"}><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{s.heading}</h3>{showClaimTag(result.sections,index)&&<Badge variant="outline" className={s.claim_class==="Inference from limited precedent"?"border-amber-400 bg-white text-amber-950":"text-[11px]"}>{s.claim_class}</Badge>}</div><p className="mt-2 whitespace-pre-line leading-7 text-slate-800">{s.text}</p></div>)}</div>
            </div>
            {(["governing","examiner","precedent"] as const).map(layer=>grouped[layer]?.length?<Collapsible key={layer} className="rounded-2xl border border-slate-200 bg-white"><CollapsibleTrigger className="flex w-full items-center justify-between p-5 text-left font-semibold"><span>{layerStyle[layer].title} <span className="font-normal text-slate-500">({grouped[layer].length} contexts)</span></span><ChevronDown className="h-5 w-5"/></CollapsibleTrigger><CollapsibleContent className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">{grouped[layer].slice(0,5).map((x:any)=><EvidenceCard key={x.id} item={x}/>)}</CollapsibleContent></Collapsible>:null)}
            {!!result.relatedEvidence?.length&&<Collapsible className="rounded-2xl border border-slate-200 bg-white"><CollapsibleTrigger className="flex w-full items-center justify-between p-5 text-left font-semibold">Related but not directly supporting evidence<ChevronDown className="h-5 w-5"/></CollapsibleTrigger><CollapsibleContent className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">{result.relatedEvidence.map((x:any)=><EvidenceCard key={x.id} item={x}/>)}</CollapsibleContent></Collapsible>}
          </section>}
        </TabsContent>
        <TabsContent value="browse"><EvidenceExplorer onSend={ids=>{setSelectedIds(ids);setQuery("What do these records collectively suggest Cambridge requires?");changeTab("ask");setResult(null);setError("")}}/></TabsContent>
        <TabsContent value="about"><AboutGuide/></TabsContent>
      </Tabs>
    </div>
  </main>
}
