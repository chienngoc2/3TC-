import type { Booking } from '@prisma/client';

type PtDayBooking = Pick<
  Booking,
  'status' | 'cancelledAt' | 'isLateCancellation' | 'isEmergencyCancellation'
>;

export function ptDayBlockReason(
  bookings: readonly PtDayBooking[],
):
  | 'PT_ALREADY_BOOKED_FOR_DISCIPLINE_DAY'
  | 'PT_REBOOK_SAME_CANCELLED_DAY'
  | null {
  if (bookings.some((booking) => booking.status !== 'CANCELLED'))
    return 'PT_ALREADY_BOOKED_FOR_DISCIPLINE_DAY';

  // A normal cancellation is reusable only when the server recorded an on-time
  // cancellation and refunded the quota in the same transaction. Unknown legacy
  // cancellation records remain blocked; emergency cancellations are refunded.
  if (
    bookings.some(
      (booking) =>
        booking.status === 'CANCELLED' &&
        !booking.isEmergencyCancellation &&
        (!booking.cancelledAt || booking.isLateCancellation !== false),
    )
  )
    return 'PT_REBOOK_SAME_CANCELLED_DAY';

  return null;
}
