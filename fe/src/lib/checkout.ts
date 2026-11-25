import { post } from './api'
import type { Checkout, CheckoutKind } from './types'
export type CheckoutInput = {
  kind: CheckoutKind
  planId?: string
  coachId?: string
  coachRatingStars?: number
  subscriptionId?: string
  addonSessions?: number
}
const storagePrefix = 'sportscenter.checkout.request:'
export function checkoutKey(userId: string, input: CheckoutInput): string {
  const key = storagePrefix + userId + ':' + JSON.stringify(input)
  let value = sessionStorage.getItem(key)
  if (!value) {
    value = `checkout-${crypto.randomUUID()}`
    sessionStorage.setItem(key, value)
  }
  return value
}
export async function createCheckout(userId: string, input: CheckoutInput): Promise<Checkout> {
  const storageKey = storagePrefix + userId + ':' + JSON.stringify(input)
  const order = await post<Checkout>('/billing/checkouts', input, {
    'Idempotency-Key': checkoutKey(userId, input),
  })
  sessionStorage.removeItem(storageKey)
  return order
}
export function retryKey(checkoutId: string): string {
  const key = `sportscenter.checkout.retry:${checkoutId}`
  let value = sessionStorage.getItem(key)
  if (!value) {
    value = `retry-${crypto.randomUUID()}`
    sessionStorage.setItem(key, value)
  }
  return value
}
export function clearRetryKey(checkoutId: string) {
  sessionStorage.removeItem(`sportscenter.checkout.retry:${checkoutId}`)
}
