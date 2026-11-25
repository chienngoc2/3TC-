import type { Eligibility } from './types'

export function activeFor(eligibility: Eligibility[], disciplineId: string, type: 'group' | 'pt') {
  const matches = eligibility.filter((item) => item.disciplineId === disciplineId)
  const available = matches.filter((item) => item[type].allowed)
  return {
    allowed: available.length > 0,
    reason: matches[0]?.[type].reason ?? 'Chưa có gói phù hợp',
    subscriptions: available.map((item) => item.subscriptionId),
  }
}
