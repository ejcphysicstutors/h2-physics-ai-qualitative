import fs from 'node:fs';
const full = JSON.parse(fs.readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
const pub = full.map(({ markScheme, ...rest }) => rest);
fs.writeFileSync(new URL('../src/data/questions.public.json', import.meta.url), JSON.stringify(pub, null, 2));
console.log(`Synced ${pub.length} public questions.`);
