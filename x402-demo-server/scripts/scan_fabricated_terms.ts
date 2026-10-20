import fs from 'node:fs';
import path from 'node:path';

const scratchDir = path.resolve(__dirname, '../scratch');
const files = fs.readdirSync(scratchDir);
const terms = ['mccarthy', '1956', '2029', 'sedol', 'siri', 'मैकार्थी', 'सेडोल', 'सिरी'];

console.log(`Scanning ${files.length} files in scratch/ for terms: ${terms.join(', ')}`);

const results: Array<{ file: string; line: number; term: string; snippet: string }> = [];

for (const file of files) {
  const filePath = path.join(scratchDir, file);
  if (!fs.statSync(filePath).isFile()) continue;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lower = lineText.toLowerCase();
      for (const term of terms) {
        if (lower.includes(term.toLowerCase())) {
          results.push({
            file,
            line: i + 1,
            term,
            snippet: lineText.trim().slice(0, 150),
          });
        }
      }
    }
  } catch (err) {}
}

console.log(`Total matches found: ${results.length}`);
for (const r of results) {
  console.log(`[${r.file}:${r.line}] (${r.term}) -> ${r.snippet}`);
}
