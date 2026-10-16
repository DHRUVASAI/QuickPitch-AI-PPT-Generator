import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const pptxPath = path.join(process.cwd(), 'scratch', 'real_pipeline_hindi_deck.pptx');
if (!fs.existsSync(pptxPath)) {
  console.error('File not found:', pptxPath);
  process.exit(1);
}

const zip = new AdmZip(pptxPath);
const zipEntries = zip.getEntries();

// Filter slide XML files
const slideEntries = zipEntries
  .filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
  .sort((a, b) => {
    const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    return numA - numB;
  });

console.log(`=== SLIDE INSPECTION FOR: real_pipeline_hindi_deck.pptx ===`);
console.log(`Total Slides: ${slideEntries.length}\n`);

for (let i = 0; i < slideEntries.length; i++) {
  const xml = slideEntries[i].getData().toString('utf-8');
  // Extract all text inside <a:t>...</a:t>
  const textMatches = Array.from(xml.matchAll(/<a:t>(.*?)<\/a:t>/g)).map(m => m[1]);
  
  console.log(`--- SLIDE ${i + 1} ---`);
  // Group into unique lines
  const uniqueTexts = Array.from(new Set(textMatches)).filter(t => t.trim().length > 0);
  for (const t of uniqueTexts) {
    console.log(`  • ${t}`);
  }
  console.log();
}
