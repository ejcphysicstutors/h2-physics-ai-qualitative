import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(here,'..');
const p4=JSON.parse(fs.readFileSync(path.join(root,'lib/data/p4-evidence.json'),'utf8'));
const evidenceTs=fs.readFileSync(path.join(root,'lib/evidence.ts'),'utf8');
const explorerRoute=fs.readFileSync(path.join(root,'app/api/explorer/route.ts'),'utf8');
const askRoute=fs.readFileSync(path.join(root,'app/api/evidence/route.ts'),'utf8');
const explorerUi=fs.readFileSync(path.join(root,'app/evidence-explorer.tsx'),'utf8');
const sourceMap=fs.readFileSync(path.join(root,'lib/source-map.ts'),'utf8');
const pageUi=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');

let failures=0;
function check(name,ok){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures++;}
const byLayer=Object.groupBy(p4,r=>r.evidence_layer);
const ids=new Set(p4.map(r=>r.record_id));

check('64 source-verified P4 records integrated',p4.length===64);
check('expected evidence-layer distribution',
  (byLayer.governing?.length||0)===34 &&
  (byLayer.current_exemplification?.length||0)===9 &&
  (byLayer.examiner_evidence?.length||0)===17 &&
  (byLayer.historical_singapore?.length||0)===4);
check('all P4 records have source URLs',p4.every(r=>String(r.source_url||'').startsWith('https://')));
check('current rows do not carry historical T-ratings',p4.filter(r=>['governing','current_exemplification'].includes(r.evidence_layer)).every(r=>['N/A',''].includes(String(r.transfer_level||''))));
check('composite manual-policy pseudo-records removed',!p4.some(r=>/^HIST-MANUAL-/.test(r.record_id)));
check('critical specimen and governing records present',['SP-Q1-READINGS','SP-Q2-READINGS','SP-Q3-REPEATS','SP-Q3-PCTU','SP-Q3-AGREE','GOV-APP-DIGITAL','GOV-SS10','GOV-SS13'].every(id=>ids.has(id)));
check('critical historical support records present',['ER-2022-RANGE','ER-2025-TIME','SG-2009-PLAN'].every(id=>ids.has(id)));
check('9702 not bulk-imported into P4 evidence bank',!p4.some(r=>String(r.syllabus)==='9702'||/9702/i.test(String(r.source_family||''))));
check('no universal six-reading requirement asserted',!p4.some(r=>/universal.{0,25}(six|6).{0,25}read/i.test(`${r.evidence_text} ${r.transferable_principle}`) && !/no universal/i.test(`${r.evidence_text} ${r.transferable_principle}`)));
check('retrieval has five evidence layers',/"governing" \| "specimen" \| "examiner" \| "historical" \| "precedent"/.test(evidenceTs));
check('ordinary practical retrieval suppresses 9702 fallback',/useHistoricalPrecedent = !practicalQuery/.test(evidenceTs));
check('Explorer exposes specimen and historical Singapore kinds',explorerRoute.includes('?"specimen"') && explorerRoute.includes('?"sg"') && explorerUi.includes('value="specimen"') && explorerUi.includes('value="sg"'));
check('Ask synthesis understands current specimen layer',askRoute.includes('current specimen') && askRoute.includes('specimen: 8'));
check('source model supports specimen and moderator documents',sourceMap.includes('Specimen Marking Guide') && sourceMap.includes('Moderator Report'));

check('narrow readings/repeats query gets query-specific concise profile',askRoute.includes('narrowRepeatCountQuery') && askRoute.includes('This compression applies only to this narrow readings/repeats query profile'));
check('other Ask queries retain normal synthesis depth',askRoute.includes('const responseProfile = narrowRepeatCountQuery ?') && askRoute.includes(': "";'));
check('narrow readings/repeats profile forbids fixed repeat-count heuristics',askRoute.includes('do not describe \"repeat three times\" or any other fixed repeat count as a workable classroom heuristic'));
check('current spreadsheet graph query has a targeted current-method profile',askRoute.includes('currentSpreadsheetGraphQuery') && askRoute.includes('obtain the gradient and y-intercept directly from the coefficients of that equation'));
check('current spreadsheet graph profile suppresses historical/manual evidence by default',askRoute.includes('candidates = candidates.filter(candidate => candidate.layer === \"governing\" || candidate.layer === \"specimen\")') && askRoute.includes('Historical/manual queries are deliberately excluded'));
check('current spreadsheet graph profile rejects manual gradient/intercept workflow',askRoute.includes('Do not instruct candidates to calculate the linear-fit gradient using two points or a large gradient triangle') && askRoute.includes('do not instruct them to read the y-intercept manually from the graph'));
check('current spreadsheet graph profile has deterministic hard-template post-processing',askRoute.includes('Hard current-method template for spreadsheet graph questions') && askRoute.includes('result.sections = currentSections') && askRoute.includes('Obtain the gradient and y-intercept directly from the coefficients of that equation.') && askRoute.includes('Do not calculate the fitted-line gradient from two plotted points, use a large gradient triangle, or read the y-intercept manually from the graph.'));
check('hard graph template cannot surface historical support sections',askRoute.includes('currentSections:any[] = []') && askRoute.includes('Current 9478 spreadsheet method — linear fit') && askRoute.includes('Current 9478 spreadsheet method — gradient at a point'));
check('current spreadsheet graph detection also recognises explicit method wording',askRoute.includes('explicitCurrentGraphMethodQuery') && askRoute.includes('gradient at (?:a )?point|local gradient'));
check('current spreadsheet graph hard template replaces generated support sections',askRoute.includes('result.sections = currentSections') && askRoute.includes('Historical hand-drawn gradient triangles, manual intercept read-offs, and tangent construction are not presented as coequal current methods here.'));
check('3 sf is framed as teaching convention rather than universal Cambridge rule',askRoute.includes('A 3 s.f. reporting rule may be described only as a safe classroom convention, not as a universal Cambridge requirement'));
check('copied citations use evidence-authority roles, not generic retrieval relevance',pageUi.includes('Direct current exemplification') && pageUi.includes('Governing requirement') && !/\$\{layers\[item\.layer\].*\$\{item\.relevance\}/.test(pageUi));

if(failures){console.error(`\n${failures} P4 integration acceptance check(s) failed.`);process.exit(1)}
console.log('\nP4 integration acceptance passed.');
