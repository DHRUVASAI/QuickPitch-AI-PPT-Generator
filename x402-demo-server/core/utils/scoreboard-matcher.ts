export interface BulletAuditRecord {
  bullet: string;
  grade: 'SUPPORTED' | 'PARTIAL' | 'NO SUPPORT';
  reason?: string;
  citedChunkIndex?: number;
  citedChunkText?: string;
  [key: string]: any;
}

export interface MatchBulletResult {
  cleanBullet: string;
  hasAuditRecord: boolean;
  matchAudit: BulletAuditRecord | null;
  pass: boolean;
  dropReason: string | null;
  citedChunk: number;
  citedChunkText: string;
}

/**
 * Matches a presentation bullet point against the pipeline verification audits.
 * 
 * Rules:
 * 1. Strips any "[UNVERIFIED: ...]" prefix before matching.
 * 2. Fail-closed: A bullet with no audit record must FAIL, never pass.
 * 3. Bullets with [UNVERIFIED: ...] prefix or non-SUPPORTED/PARTIAL grade fail with appropriate reason.
 */
export function matchBulletToAudit(
  rawBullet: string,
  reportAudits: BulletAuditRecord[],
  fallbackChunkIndex: number = 1
): MatchBulletResult {
  // Strip any [UNVERIFIED: ...] prefix before matching
  const cleanBullet = rawBullet.replace(/^\[UNVERIFIED:[^\]]+\]\s*/i, '').trim();

  // Find matching audit record by comparing clean strings
  const matchAudit = reportAudits.find((a) => {
    if (!a || !a.bullet) return false;
    const cleanAuditBullet = a.bullet.replace(/^\[UNVERIFIED:[^\]]+\]\s*/i, '').trim();
    return (
      cleanAuditBullet === cleanBullet ||
      cleanBullet.includes(cleanAuditBullet) ||
      cleanAuditBullet.includes(cleanBullet)
    );
  }) || null;

  const hasAuditRecord = matchAudit !== null;

  // RULE: A bullet with NO audit record must FAIL, never pass!
  if (!hasAuditRecord) {
    return {
      cleanBullet,
      hasAuditRecord: false,
      matchAudit: null,
      pass: false,
      dropReason: 'No verification audit record found for bullet',
      citedChunk: fallbackChunkIndex,
      citedChunkText: `Chunk ${fallbackChunkIndex} source excerpt`,
    };
  }

  // Check if raw bullet carried the unverified prefix
  const hadUnverifiedPrefix = /^\[UNVERIFIED:[^\]]+\]/i.test(rawBullet);

  const isPassed = !hadUnverifiedPrefix && (matchAudit.grade === 'SUPPORTED' || matchAudit.grade === 'PARTIAL');
  const dropReason = isPassed
    ? null
    : (matchAudit.reason || (hadUnverifiedPrefix ? 'Flagged as unverified by pipeline' : 'Failed factual verification'));

  const citedChunk = matchAudit.citedChunkIndex ?? fallbackChunkIndex;
  const citedChunkText = matchAudit.citedChunkText ?? `Chunk ${citedChunk} source excerpt`;

  return {
    cleanBullet,
    hasAuditRecord: true,
    matchAudit,
    pass: isPassed,
    dropReason,
    citedChunk,
    citedChunkText,
  };
}
