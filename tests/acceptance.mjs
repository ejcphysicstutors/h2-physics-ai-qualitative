import fs from "node:fs";
const root = new URL("../", import.meta.url);
const er=JSON.parse(fs.readFileSync(new URL("lib/data/er.json",root)));
const ms=JSON.parse(fs.readFileSync(new URL("lib/data/precedent.json",root)));
const sy=JSON.parse(fs.readFileSync(new URL("lib/data/syllabus.json",root)));
const route=fs.readFileSync(new URL("app/api/evidence/route.ts",root),"utf8");
const page=fs.readFileSync(new URL("app/page.tsx",root),"utf8");
const checks=[
  ["evidence corpus present",er.length>0&&ms.length>0&&sy.length===20],
  ["server-side API key only",route.includes("process.env.OPENAI_API_KEY")&&!page.includes("OPENAI_API_KEY")],
  ["two-stage screening",route.includes("Directly relevant")&&route.includes("Closely analogous")&&route.includes("Background only")&&route.includes("Irrelevant")],
  ["unsupported claims removed",route.includes("s.supporting_ids.length > 0")],
  ["dynamic evidence-base summary",route.includes("verified9478ItemCount")&&page.includes("precedent-only")],
  ["limited inference guard",route.includes("An omission is not a rejection")&&route.includes("Inference from limited precedent")],
  ["no false top-line failure",route.includes('result.judgement === "No matching supporting evidence found"')&&page.includes("No relevant evidence of any kind was found")],
  ["teacher interpretation default off",page.includes("useState(false)")],
  ["source records not public",!fs.existsSync(new URL("public/data",root))]
];
let failed=0;for(const [name,ok] of checks){console.log(ok?"PASS":"FAIL",name);if(!ok)failed++}process.exitCode=failed?1:0;
