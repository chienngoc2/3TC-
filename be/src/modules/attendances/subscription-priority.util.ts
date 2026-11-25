export function getSubscriptionTierWeight(sub: {
  packageTier?: string | null;
  plan?: { name?: string | null; packageTier?: string | null } | null;
}): number {
  const tier = (sub.packageTier || sub.plan?.packageTier || '').toUpperCase();
  const name = (sub.plan?.name || '').toUpperCase();

  // VIP priority: Gym VIP, Yoga VIP, Boxing VIP, or tier VIP
  if (tier === 'VIP' || name.includes('VIP')) return 40;
  // PLUS priority: Gym Plus, Yoga Plus, Boxing Plus, etc.
  if (tier === 'PLUS' || name.includes('PLUS')) return 30;
  // DROP_IN / Gói buổi / Session packs
  if (
    tier === 'DROP_IN' ||
    name.includes('BUỔI') ||
    name.includes('DROP-IN') ||
    name.includes('DROP_IN') ||
    name.includes('SESSION')
  ) {
    return 20;
  }
  // TRIAL / Dùng thử
  if (tier === 'TRIAL' || name.includes('THỬ')) return 10;
  return 25; // default fallback
}

export function sortSubscriptionsByPriority<
  T extends {
    status?: string;
    packageTier?: string | null;
    plan?: { name?: string | null; packageTier?: string | null } | null;
    endDate?: Date | string | null;
  },
>(subs: T[]): T[] {
  return [...subs].sort((a, b) => {
    // 1. ACTIVE before non-active
    const statusScoreA = a.status === 'ACTIVE' ? 1 : 0;
    const statusScoreB = b.status === 'ACTIVE' ? 1 : 0;
    if (statusScoreA !== statusScoreB) return statusScoreB - statusScoreA;

    // 2. Tier priority: VIP (40) > PLUS (30) > DROP_IN (20) > TRIAL (10)
    const tierDiff = getSubscriptionTierWeight(b) - getSubscriptionTierWeight(a);
    if (tierDiff !== 0) return tierDiff;

    // 3. Expiration date: furthest expiration first
    const endA = a.endDate ? new Date(a.endDate).getTime() : 0;
    const endB = b.endDate ? new Date(b.endDate).getTime() : 0;
    return endB - endA;
  });
}
