import { describe, it } from 'node:test';
import assert from 'node:assert';
import { matchBulletToAudit, type BulletAuditRecord } from '../core/utils/scoreboard-matcher.js';

describe('Scoreboard Bullet Matching & Fail-Closed Behavior', () => {
  it('(a) a bullet with the [UNVERIFIED: NO SUPPORT] prefix is matched to its audit record', () => {
    const reportAudits: BulletAuditRecord[] = [
      {
        bullet: 'Narrow AI focuses on specific tasks like AlphaGo for Go',
        grade: 'NO SUPPORT',
        reason: 'Claim is not stated in source passage (LLM Yes/No check: NO)',
        citedChunkIndex: 1,
        citedChunkText: 'Source text for chunk 1',
      },
      {
        bullet: 'Artificial Intelligence products aim to mimic human intelligence',
        grade: 'SUPPORTED',
        reason: 'All numbers, names, and core claims are verified',
        citedChunkIndex: 1,
        citedChunkText: 'Source text for chunk 1',
      },
    ];

    const rawBullet = '[UNVERIFIED: NO SUPPORT] Narrow AI focuses on specific tasks like AlphaGo for Go';
    const result = matchBulletToAudit(rawBullet, reportAudits);

    // 1. Must successfully match to the audit record despite the prefix
    assert.strictEqual(result.hasAuditRecord, true);
    assert.strictEqual(result.cleanBullet, 'Narrow AI focuses on specific tasks like AlphaGo for Go');
    assert.ok(result.matchAudit !== null);
    assert.strictEqual(result.matchAudit?.grade, 'NO SUPPORT');

    // 2. Must NOT pass because it was flagged as unverified and had NO SUPPORT
    assert.strictEqual(result.pass, false);
    assert.strictEqual(typeof result.dropReason, 'string');
    assert.ok(result.dropReason && result.dropReason.length > 0);
  });

  it('(b) a bullet with no audit record fails', () => {
    const reportAudits: BulletAuditRecord[] = [
      {
        bullet: 'Known and audited bullet point',
        grade: 'SUPPORTED',
        reason: 'Verified',
        citedChunkIndex: 2,
      },
    ];

    const unrecordedBullet = 'Mysterious bullet with no audit record in pipeline';
    const result = matchBulletToAudit(unrecordedBullet, reportAudits);

    // 1. Must indicate no audit record was found
    assert.strictEqual(result.hasAuditRecord, false);
    assert.strictEqual(result.matchAudit, null);

    // 2. Must FAIL closed
    assert.strictEqual(result.pass, false);
    assert.strictEqual(result.dropReason, 'No verification audit record found for bullet');
  });

  it('a valid supported bullet with audit record passes', () => {
    const reportAudits: BulletAuditRecord[] = [
      {
        bullet: 'Verified factual claim from video',
        grade: 'SUPPORTED',
        reason: 'All entities confirmed',
        citedChunkIndex: 3,
        citedChunkText: 'Excerpt 3',
      },
    ];

    const result = matchBulletToAudit('Verified factual claim from video', reportAudits);
    assert.strictEqual(result.hasAuditRecord, true);
    assert.strictEqual(result.pass, true);
    assert.strictEqual(result.dropReason, null);
    assert.strictEqual(result.citedChunk, 3);
  });
});
