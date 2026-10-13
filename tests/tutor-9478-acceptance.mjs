import assert from 'node:assert/strict';
import fs from 'node:fs';
const full=JSON.parse(fs.readFileSync('data/questions.json','utf8'));
const pub=JSON.parse(fs.readFileSync('src/data/questions.public.json','utf8'));
const topics=JSON.parse(fs.readFileSync('src/data/syllabus9478.json','utf8'));
assert.equal(full.length,205);
assert.equal(pub.length,205);
assert.equal(new Set(full.map(q=>q.id)).size,205);
assert.equal(topics.length,20);
const topicCodes=new Set(topics.map(t=>t.code));
for(const q of full){
  assert(topicCodes.has(q.topicCode),`${q.id} has invalid topic`);
  assert(q.legacyCurriculum?.topicCode,`${q.id} lost legacy topic`);
  assert(q.curriculumReview,`${q.id} has no review metadata`);
}
for(const q of pub){assert(!Object.hasOwn(q,'markScheme'),`${q.id} leaks mark scheme`)}
assert.deepEqual(full.map(q=>q.id),pub.map(q=>q.id));
assert.equal(full.find(q=>q.id==='H218-001').topicCode,'9478-15');
assert.equal(full.find(q=>q.id==='H218-002').topicCode,'9478-15');
assert.equal(full.find(q=>q.id==='H205-001').curriculumReview.requiresReview,true);
console.log('PASS: 205 original IDs preserved; 20 9478 topics; no public mark schemes; remaps and review flags preserved.');
