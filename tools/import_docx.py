import json, re, mimetypes
from pathlib import Path
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

SRC = Path('/mnt/data/Qualitative Questions (2026 Syllabus) edit superposition.docx')
ROOT = Path('/mnt/data/h2-physics-ai-qualitative')
OUT_JSON = ROOT / 'data/questions.json'
IMG_DIR = ROOT / 'public/question-images'
IMG_DIR.mkdir(parents=True, exist_ok=True)

def iter_blocks(doc):
    for child in doc.element.body.iterchildren():
        if child.tag.endswith('}p'):
            yield Paragraph(child, doc)
        elif child.tag.endswith('}tbl'):
            yield Table(child, doc)

def clean(s):
    s = s.replace('\r','').replace('\u00a0',' ')
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n[ \t]+', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()

def image_blobs(cell, doc):
    out=[]
    for blip in cell._tc.xpath('.//a:blip'):
        rid=blip.get(qn('r:embed'))
        if not rid: continue
        part=doc.part.related_parts[rid]
        blob=part.blob
        ctype=part.content_type
        ext=mimetypes.guess_extension(ctype) or '.png'
        if ext=='.jpe': ext='.jpg'
        out.append((blob,ext))
    return out

doc=Document(SRC)
current_topic=None
questions=[]
counts={}
for block in iter_blocks(doc):
    if isinstance(block, Paragraph):
        txt=clean(block.text)
        if block.style and block.style.name == 'Heading 2' and txt.startswith('#H'):
            m=re.match(r'#(H\d{3})\s+(.+)',txt)
            if m:
                current_topic={'code':m.group(1),'name':m.group(2).title()}
                counts.setdefault(m.group(1),0)
        continue
    if not current_topic:
        continue
    for row in block.rows:
        if len(row.cells)<3: continue
        num=clean(row.cells[0].text)
        q=clean(row.cells[1].text)
        a=clean(row.cells[2].text)
        if not q or q.upper()=='QUESTION' or a.upper()=='MARK SCHEME':
            continue
        counts[current_topic['code']]+=1
        idx=counts[current_topic['code']]
        qid=f"{current_topic['code']}-{idx:03d}"
        images=[]
        for j,(blob,ext) in enumerate(image_blobs(row.cells[1],doc),start=1):
            name=f"{qid}-{j}{ext}"
            (IMG_DIR/name).write_bytes(blob)
            images.append(f"/question-images/{name}")
        questions.append({
            'id': qid,
            'topicCode': current_topic['code'],
            'topic': current_topic['name'],
            'sourceNumber': num or str(idx),
            'question': q,
            'markScheme': a,
            'images': images,
            'syllabusVersion': '2026'
        })
OUT_JSON.write_text(json.dumps(questions,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'wrote {len(questions)} questions and {sum(len(q["images"]) for q in questions)} images')
for code in sorted(counts): print(code,counts[code])
