import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

export function getFileSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'FILE_NOT_FOUND';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'UNKNOWN_COMMIT';
  }
}

export function writeEvidence(name: string, data: any, inputFiles: string[] = []): { path: string; relativePath: string; fullData: any } {
  const commit = getGitCommit();
  const timestamp = new Date().toISOString();

  const inputs = inputFiles.map(file => {
    const absPath = path.resolve(file);
    const exists = fs.existsSync(absPath);
    let sha256 = 'FILE_NOT_FOUND';
    let mtime: string | undefined = undefined;
    if (exists) {
      sha256 = getFileSha256(absPath);
      mtime = fs.statSync(absPath).mtime.toISOString();
    }
    return {
      path: file,
      absPath,
      exists,
      sha256,
      mtime,
    };
  });

  const fullData = {
    evidenceName: name,
    timestamp,
    gitCommit: commit,
    inputs,
    data,
  };

  const filename = name.endsWith('.json') ? name : `${name}.json`;

  // Write to both x402-demo-server/evidence/round39 and root evidence/round39
  const rootDir = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  const primaryDir = path.join(rootDir, 'evidence', 'round39');
  const serverDir = path.join(rootDir, 'x402-demo-server', 'evidence', 'round39');

  if (!fs.existsSync(primaryDir)) {
    fs.mkdirSync(primaryDir, { recursive: true });
  }
  fs.writeFileSync(path.join(primaryDir, filename), JSON.stringify(fullData, null, 2), 'utf-8');

  const primaryPath = path.join(primaryDir, filename);
  const relativePath = path.relative(rootDir, primaryPath).replace(/\\/g, '/');

  return { path: primaryPath, relativePath, fullData };
}
