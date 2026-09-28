import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { localDate } from '../../common/utils/domain';

@Injectable()
export class MemberCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async week(
    week: string,
    memberId: string,
    disciplineId?: string,
    view: 'all' | 'group' | 'pt' | 'mine' = 'all',
  ) {
    const monday = new Date(`${week}T00:00:00Z`);
    if (
      Number.isNaN(monday.getTime()) ||
      monday.toISOString().slice(0, 10) !== week ||
      monday.getUTCDay() !== 1
    )
      throw new BadRequestException('WEEK_MUST_BE_MONDAY');
    const start = new Date(monday.getTime() - 7 * 3600000);
    const end = new Date(start.getTime() + 7 * 86400000);
    const today = localDate();
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: { userId: memberId, ...(disciplineId ? { disciplineId } : {}) },
      include: {
        plan: { select: { name: true } },
        assignedCoach: { select: { id: true, fullName: true } },
      },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'asc' }],
    });
    const coachIds = [
      ...new Set(
        subscriptions
          .filter((sub) => sub.assignedCoachId)
          .map((sub) => sub.assignedCoachId!),
      ),
    ];
    const [schedules, slots, bookings] = await Promise.all([
      view === 'pt' || view === 'mine'
        ? []
        : this.prisma.schedule.findMany({
            where: {
              startTime: { gte: start, lt: end },
              status: { in: ['OPEN', 'FULL'] },
              ...(disciplineId ? { class: { disciplineId } } : {}),
            },
            include: {
              class: { include: { discipline: true } },
              coach: { select: { id: true, fullName: true } },
              room: true,
            },
            orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
          }),
      view === 'group' || view === 'mine' || !coachIds.length
        ? []
        : this.prisma.coachAvailability.findMany({
            where: {
              coachId: { in: coachIds },
              startTime: { gte: start, lt: end },
              isBooked: false,
              isEmergencyCancelled: false,
              coach: { isActive: true },
            },
            include: { coach: { select: { id: true, fullName: true } } },
            orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
          }),
      this.prisma.booking.findMany({
        where: {
          memberId,
          ...(disciplineId ? { disciplineId } : {}),
          OR: [
            { schedule: { startTime: { gte: start, lt: end } } },
            { coachAvailability: { startTime: { gte: start, lt: end } } },
          ],
        },
        include: {
          schedule: { include: { class: true } },
          coachAvailability: {
            include: { coach: { select: { id: true, fullName: true } } },
          },
          attendance: true,
        },
        orderBy: [{ bookedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday.getTime() + index * 86400000);
      const dateText = date.toISOString().slice(0, 10);
      const eligibility = subscriptions.map((sub) => {
        const active =
          sub.status === 'ACTIVE' &&
          sub.startDate <= today &&
          sub.startDate <= date &&
          sub.endDate >= date &&
          sub.endDate >= today;
        const sameDayPt = bookings.filter(
          (booking) =>
            booking.bookingType === 'PERSONAL_TRAINING' &&
            booking.disciplineId === sub.disciplineId &&
            booking.coachAvailability?.startTime &&
            localDate(booking.coachAvailability.startTime).getTime() ===
              date.getTime(),
        );
        const activePt = sameDayPt.some(
          (booking) => booking.status !== 'CANCELLED',
        );
        const cancelledPt = sameDayPt.some(
          (booking) =>
            booking.status === 'CANCELLED' &&
            booking.cancelledBy === 'MEMBER' &&
            !booking.isEmergencyCancellation,
        );
        return {
          subscriptionId: sub.id,
          disciplineId: sub.disciplineId,
          group: {
            allowed: active && (sub.remainingGroupSessions ?? 0) > 0,
            reason: !active
              ? 'SUBSCRIPTION_NOT_ACTIVE_ON_DAY'
              : (sub.remainingGroupSessions ?? 0) <= 0
                ? 'GROUP_QUOTA_EXHAUSTED'
                : null,
          },
          pt: {
            allowed:
              active &&
              (sub.remainingPtSessions ?? 0) > 0 &&
              !activePt &&
              !cancelledPt,
            reason: !active
              ? 'SUBSCRIPTION_NOT_ACTIVE_ON_DAY'
              : (sub.remainingPtSessions ?? 0) <= 0
                ? 'PT_QUOTA_EXHAUSTED'
                : activePt
                  ? 'PT_ALREADY_BOOKED_FOR_DISCIPLINE_DAY'
                  : cancelledPt
                    ? 'PT_REBOOK_SAME_CANCELLED_DAY'
                    : null,
          },
        };
      });
      return { date: dateText, eligibility };
    });

    return {
      weekStart: week,
      weekEndExclusive: new Date(monday.getTime() + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
      timezone: 'Asia/Ho_Chi_Minh',
      schedules: schedules.map((schedule) => ({
        ...schedule,
        type: 'GROUP_CLASS',
        startAt: schedule.startTime,
        endAt: schedule.endTime,
        disciplineId: schedule.class.disciplineId,
      })),
      ptSlots: slots.map((slot) => ({
        ...slot,
        type: 'PERSONAL_TRAINING',
        startAt: slot.startTime,
        endAt: slot.endTime,
        eligibleDisciplines: [
          ...new Set(
            subscriptions
              .filter((sub) => sub.assignedCoachId === slot.coachId)
              .map((sub) => sub.disciplineId),
          ),
        ],
      })),
      bookings: bookings.map((booking) => ({
        ...booking,
        startAt:
          booking.schedule?.startTime ?? booking.coachAvailability?.startTime,
        endAt: booking.schedule?.endTime ?? booking.coachAvailability?.endTime,
      })),
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        disciplineId: sub.disciplineId,
        planName: sub.plan.name,
        assignedCoach: sub.assignedCoach,
        startDate: sub.startDate,
        endDate: sub.endDate,
        status: sub.status,
        remainingGroupSessions: sub.remainingGroupSessions,
        remainingPtSessions: sub.remainingPtSessions,
      })),
      days,
    };
  }
}
