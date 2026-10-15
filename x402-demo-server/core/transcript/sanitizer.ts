export function cleanTextForPptx(text: string, maxLen: number = 200): string {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>?/gm, ' ') // Strip HTML tags
    .replace(/https?:\/\/[^\s]+/gi, '') // Strip raw URLs
    .replace(/www\.[^\s]+/gi, '')
    .replace(/org\/licenses\/[^\s]+/gi, '')
    .replace(/verify at http[^\s]*/gi, '')
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Strip non-printable ASCII
    .replace(/&/g, 'and')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeTranscriptText(textContext: string, maxLen: number = 25000): string {
  if (!textContext) return '';

  let cleaned = textContext
    .replace(/^WEBVTT$/gm, '')
    .replace(/^Kind:.*$/gm, '')
    .replace(/^Language:.*$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, ' ') // SRT/VTT timestamps
    .replace(/\d{2}:\d{2}:\d{2}/g, ' ')
    .replace(/\d{2}:\d{2}/g, ' ')
    .replace(/-\s*\[\s*\]/g, ' ')
    .replace(/-\s*\[\s*x\s*\]/gi, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/^\s*\d+\s*$/gm, ' ')
    .replace(/\[Music\]|\[Applause\]|\[Laughter\]|\[Audio\]|\[Video\]|\[Silence\]/gi, ' ')
    .replace(/this program is brought to you by.*?(?:stanford|university|sponsor|channel|\.)/gi, ' ')
    .replace(/subscribe to (?:my|our) channel|like and subscribe|welcome back to/gi, ' ')
    .replace(/please visit us at.*?(?:edu|com|org|\s)/gi, ' ')
    .replace(/Source Video Title:|Video Description & Context:|Presentation request for/gi, ' ');

  // Filter out line noise
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (/^[0-9\s.,\-_:\[\]]+$/.test(line)) return false;
      if (line.length < 5) return false;
      const words = line.match(/[\p{L}\p{M}]{2,}/gu);
      return Boolean(words && words.length >= 2);
    })
    .join(' ');

  return cleanTextForPptx(cleaned, maxLen);
}
