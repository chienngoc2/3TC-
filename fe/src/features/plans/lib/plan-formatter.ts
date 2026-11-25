/**
 * Tiện ích chuyển đổi các thuật ngữ tiếng Anh trong gói tập (Drop-in, group class, PT session...)
 * sang tiếng Việt ngắn gọn, dễ hiểu cho hội viên.
 */

export function formatTierLabel(tier?: string | null): string {
  if (!tier) return 'GÓI TẬP';
  const t = tier.toUpperCase().replace(/[-\s]/g, '_');
  if (t === 'VIP') return 'GÓI VIP';
  if (t === 'PLUS') return 'GÓI PLUS';
  if (t === 'DROP_IN' || t === 'DROPIN') return 'VÉ BUỔI';
  if (t === 'TRIAL') return 'DÙNG THỬ';
  return tier;
}

export function formatCheckoutStatus(status?: string | null): {
  label: string;
  variant: 'pending' | 'success' | 'failed' | 'neutral';
} {
  if (!status) return { label: 'Chưa xác định', variant: 'neutral' };
  switch (status.toUpperCase()) {
    case 'PENDING_PAYMENT':
      return { label: 'Chờ thanh toán', variant: 'pending' };
    case 'FULFILLED':
      return { label: 'Đã thanh toán thành công', variant: 'success' };
    case 'PAYMENT_FAILED':
      return { label: 'Thanh toán thất bại', variant: 'failed' };
    case 'EXPIRED':
      return { label: 'Đã hết hạn thanh toán', variant: 'failed' };
    case 'PAYMENT_REVIEW':
      return { label: 'Đang rà soát thanh toán', variant: 'pending' };
    case 'REFUND_PENDING':
      return { label: 'Chờ hoàn tiền', variant: 'pending' };
    case 'REFUNDED':
      return { label: 'Đã hoàn tiền', variant: 'neutral' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function formatCheckoutKind(kind?: string | null): string {
  if (!kind) return 'Gói tập';
  switch (kind.toUpperCase()) {
    case 'NEW_SUBSCRIPTION':
      return 'Đăng ký gói tập mới';
    case 'RENEWAL':
      return 'Gia hạn gói tập';
    case 'PT_ADDON':
      return 'Mua thêm buổi tập HLV kèm riêng';
    default:
      return kind;
  }
}

export function formatPlanName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(/\s*[-–—]\s*(?:HLV|Coach)\s*.*$/i, '')
    .replace(/\s*\(\s*\d+\s*buổi\s*\/\s*tháng\s*\)/gi, '')
    .replace(/\bDrop-?in\b/gi, 'Vé Buổi')
    .replace(/\bGroup\s*Classes?\b/gi, 'Lớp Nhóm')
    .replace(/\bPT\s*Sessions?\b/gi, 'Kèm PT')
    .trim();
}

export function extractThemeAndCoach(planName?: string | null): { theme: string; coachName?: string } {
  if (!planName) return { theme: '' };
  const match = planName.match(/^(.*?)\s*[-–—]\s*(?:HLV|Coach)\s*(.*)$/i);
  if (match) {
    return {
      theme: formatPlanName(match[1].trim()),
      coachName: match[2].trim(),
    };
  }
  return { theme: formatPlanName(planName.trim()) };
}

export function formatPlanDescription(desc?: string | null): string {
  if (!desc) {
    return 'Trải nghiệm luyện tập thể thao chuyên nghiệp với trang thiết bị cao cấp.';
  }

  let text = desc.trim();

  // Pattern match: "X group classes + Y PT sessions" (e.g. "1 group classes + 0 PT sessions")
  const standardPattern = /^(\d+)\s+group\s+classes?\s*\+\s*(\d+)\s+PT\s+sessions?(?:\s*\+\s*(.*))?$/i;
  const match = text.match(standardPattern);
  if (match) {
    const groups = parseInt(match[1], 10);
    const pt = parseInt(match[2], 10);
    const extra = match[3]?.trim();

    const parts: string[] = [];
    if (groups > 0) {
      parts.push(`${groups} buổi lớp nhóm`);
    }
    if (pt > 0) {
      parts.push(`${pt} buổi kèm PT 1:1`);
    }
    if (groups === 0 && pt === 0) {
      parts.push('Vé vào tập tự do');
    }
    if (extra) {
      const extraVi = extra
        .replace(/free\s+boxing\s+bag\s+access/gi, 'tự do tập bao cát boxing')
        .replace(/drop-?in/gi, 'vé buổi');
      parts.push(extraVi);
    }
    return parts.join(' · ');
  }

  // Generic replacements if not exact pattern match
  return text
    .replace(/(\d+)\s+group\s+classes?/gi, '$1 buổi lớp nhóm')
    .replace(/(\d+)\s+PT\s+sessions?/gi, '$1 buổi kèm PT')
    .replace(/free\s+boxing\s+bag\s+access/gi, 'tự do tập bao cát boxing')
    .replace(/\bDrop-?in\b/gi, 'vé buổi')
    .replace(/\bGroup\s*Classes?\b/gi, 'Lớp nhóm')
    .replace(/\bPT\s*Sessions?\b/gi, 'Kèm PT')
    .trim();
}

