import { describe, expect, it } from 'vitest'
import { activeFor } from '../src/lib/eligibility'
import type { Eligibility } from '../src/lib/types'

const eligibility: Eligibility[] = [
  {
    subscriptionId: 'expired-yoga',
    disciplineId: 'yoga',
    group: { allowed: false, reason: 'SUBSCRIPTION_NOT_ACTIVE_ON_DAY' },
    pt: { allowed: false, reason: 'SUBSCRIPTION_NOT_ACTIVE_ON_DAY' },
  },
  {
    subscriptionId: 'active-yoga',
    disciplineId: 'yoga',
    group: { allowed: true, reason: null },
    pt: { allowed: false, reason: 'PT_QUOTA_EXHAUSTED' },
  },
  {
    subscriptionId: 'active-boxing',
    disciplineId: 'boxing',
    group: { allowed: true, reason: null },
    pt: { allowed: true, reason: null },
  },
]

describe('calendar subscription eligibility', () => {
  it('counts only allowed subscriptions for the selected discipline and booking type', () => {
    expect(activeFor(eligibility, 'yoga', 'group')).toMatchObject({
      allowed: true,
      subscriptions: ['active-yoga'],
    })
    expect(activeFor(eligibility, 'yoga', 'pt')).toMatchObject({
      allowed: false,
      subscriptions: [],
    })
    expect(activeFor(eligibility, 'boxing', 'pt').subscriptions).toEqual(['active-boxing'])
  })
})
