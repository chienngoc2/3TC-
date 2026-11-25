export interface ParsedCoachNotes {
  topicTitle: string | null;
  topicDescription: string | null;
  coachNote: string | null;
}

/**
 * Splits structured workout plan notes into distinct topic metadata and extra coach notes,
 * removing duplicate `[CHUYÊN ĐỀ]` / `--- GHI CHÚ ---` blocks from legacy saved strings.
 */
export function parseCoachNotes(raw?: string | null): ParsedCoachNotes {
  if (!raw || !raw.trim()) {
    return { topicTitle: null, topicDescription: null, coachNote: null };
  }

  const normalized = raw.replace(/\r\n/g, '\n').trim();
  const topicMatch = normalized.match(/\[CHUYÊN ĐỀ\]:\s*([^\n]+)/);
  const descMatch = normalized.match(/•\s*Nội dung:\s*([^\n]+)/);
  const topicTitle = topicMatch ? topicMatch[1].trim() : null;
  const topicDescription = descMatch ? descMatch[1].trim() : null;

  const afterGhiChu = normalized.includes('--- GHI CHÚ ---')
    ? normalized.split('--- GHI CHÚ ---').pop()?.trim() || ''
    : normalized;

  let cleaned = afterGhiChu
    .replace(/^\[GIÁO ÁN\]:[^\n]*\n?/gm, '')
    .replace(/--- DANH SÁCH BÀI TẬP[^-]*---[\s\S]*?(?=--- GHI CHÚ ---|$)/g, '')
    .replace(/\[CHUYÊN ĐỀ\]:[^\n]*\n?/g, '')
    .replace(/•\s*Nội dung:[^\n]*\n?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (topicTitle && cleaned === topicTitle) cleaned = '';
  if (topicDescription && cleaned === topicDescription) cleaned = '';

  return {
    topicTitle,
    topicDescription,
    coachNote: cleaned || null,
  };
}
