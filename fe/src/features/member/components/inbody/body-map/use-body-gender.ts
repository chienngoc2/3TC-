import { useState } from 'react'
import type { AuthUser } from '@/types/auth.types'
import type { BodyGender } from './body-map-assets'

export type ProfileGender = AuthUser['gender']

const genderKey = (userId: string | undefined) => `sportscenter.inbody.gender.${userId ?? 'guest'}`

function readStoredGender(userId: string | undefined): BodyGender | null {
  try {
    const value = localStorage.getItem(genderKey(userId))
    return value === 'female' || value === 'male' ? value : null
  } catch {
    return null
  }
}

/** MALE/FEMALE from the member's profile; OTHER or missing leaves the choice to the member. */
function profileBodyGender(gender: ProfileGender): BodyGender | null {
  return gender === 'MALE' ? 'male' : gender === 'FEMALE' ? 'female' : null
}

export interface BodyGenderState {
  gender: BodyGender
  /** Where the current gender comes from, for the hint under the toggle. */
  source: 'profile' | 'override' | 'member'
  choose: (next: BodyGender) => void
}

/**
 * Body figure gender: a choice made on this visit, then the profile, then the member's
 * remembered choice on this device, then male.
 */
export function useBodyGender(
  userId: string | undefined,
  profileGender: ProfileGender,
): BodyGenderState {
  const fromProfile = profileBodyGender(profileGender)
  const [stored] = useState(() => readStoredGender(userId))
  const [manual, setManual] = useState<BodyGender | null>(null)
  const gender = manual ?? fromProfile ?? stored ?? 'male'

  const choose = (next: BodyGender) => {
    setManual(next)
    // The profile is the source of truth when it has a gender; only remember a local choice
    // for members whose profile does not say.
    if (fromProfile) return
    try {
      localStorage.setItem(genderKey(userId), next)
    } catch {
      // Private mode or blocked storage: the choice still applies for this visit.
    }
  }

  return {
    gender,
    source: fromProfile ? (manual && manual !== fromProfile ? 'override' : 'profile') : 'member',
    choose,
  }
}
