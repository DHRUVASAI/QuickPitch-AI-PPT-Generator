import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';

describe('verifyQuote Utility Tests', () => {
  const tmpFile = path.join(os.tmpdir(), `test_verify_quote_${Date.now()}.txt`);

  it('should verify exact substring and report correct 1-indexed line index', () => {
    const text = 'Line 1: Hello World\nLine 2: Artificial Intelligence\nLine 3: Kurzweil 2045 Singularity\nLine 4: Masayoshi Son SoftBank';
    fs.writeFileSync(tmpFile, text, 'utf-8');

    const res1 = verifyQuote(tmpFile, 'Hello World');
    assert.strictEqual(res1.verified, true);
    assert.strictEqual(res1.lineIndex, 1);

    const res2 = verifyQuote(tmpFile, 'Artificial Intelligence');
    assert.strictEqual(res2.verified, true);
    assert.strictEqual(res2.lineIndex, 2);

    const res3 = verifyQuote(tmpFile, 'Kurzweil 2045');
    assert.strictEqual(res3.verified, true);
    assert.strictEqual(res3.lineIndex, 3);

    const formatted = formatVerifiedQuote(res3);
    assert.ok(formatted.includes('L3'));
    assert.ok(formatted.includes('Kurzweil 2045'));
    assert.ok(formatted.startsWith('[VERIFIED:'));
  });

  it('should return verified: false when quote does not exist in file', () => {
    const res = verifyQuote(tmpFile, 'Invented Nonexistent Quote 9999');
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.lineIndex, -1);

    const formatted = formatVerifiedQuote(res);
    assert.ok(formatted.startsWith('[UNVERIFIED:'));
  });

  it('should return verified: false for nonexistent file', () => {
    const res = verifyQuote('nonexistent_file_path_12345.txt', 'anything');
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.lineIndex, -1);
  });
});
