export const memberKeys = {
  catalog: (disciplineId?: string, tier?: string) =>
    ['catalog', disciplineId ?? 'all', tier ?? 'all'] as const,
  checkout: (userId: string, checkoutId: string) =>
    ['member', userId, 'checkout', checkoutId] as const,
  transactions: (userId: string) => ['member', userId, 'transactions'] as const,
  subscriptions: (userId: string) => ['member', userId, 'subscriptions'] as const,
  invoices: (userId: string) => ['member', userId, 'invoices'] as const,
  calendar: (userId: string, week: string, disciplineId?: string, view = 'all') =>
    ['member', userId, 'calendar', week, disciplineId ?? 'all', view] as const,
  history: (userId: string) => ['member', userId, 'history'] as const,
}
