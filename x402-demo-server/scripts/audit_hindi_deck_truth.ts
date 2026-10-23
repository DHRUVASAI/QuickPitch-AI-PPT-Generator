import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const scoreboardPath = path.join(repoRoot, 'evidence/scoreboard.json');
const raw = fs.readFileSync(scoreboardPath, 'utf-8');
const data = JSON.parse(raw);

const hindiVid = data.videos.find((v: any) => v.videoId === 'qzAHXO-cN5Q');
if (!hindiVid) {
  console.error('Hindi video not found in scoreboard.json');
  process.exit(1);
}

console.log(`Found ${hindiVid.bullets.length} bullets for qzAHXO-cN5Q:`);
hindiVid.bullets.forEach((b: any, idx: number) => {
  console.log(`Bullet #${idx + 1} (Slide ${b.slide}): "${b.bullet}" [pass: ${b.pass}]`);
});
