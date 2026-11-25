import { describe, expect, it } from 'vitest'
import { addDays, isMonday, mondayInVietnam, shiftWeek } from '../src/lib/date'
describe('Vietnam week routing', () => {
  it('uses Monday in Vietnam even when UTC is still Sunday', () => {
    expect(mondayInVietnam(new Date('2026-09-27T18:00:00Z'))).toBe('2026-09-28')
    expect(mondayInVietnam(new Date('2026-10-01T00:00:00Z'))).toBe('2026-09-28')
  })
  it('moves in seven-day steps without browser timezone drift', () => {
    expect(shiftWeek('2026-09-28', -1)).toBe('2026-09-21')
    expect(shiftWeek('2026-09-28', 1)).toBe('2026-10-05')
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04')
    expect(isMonday('2026-09-28')).toBe(true)
    expect(isMonday('2026-09-29')).toBe(false)
    expect(isMonday('2026-02-30')).toBe(false)
  })
})
