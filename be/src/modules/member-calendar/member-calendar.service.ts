import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { localDate } from '../../common/utils/domain';
import { ptDayBlockReason } from '../../common/utils/pt-day-policy';
import { isClassCompatibleWithPlan } from '../../common/utils/topic-matcher';

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
        plan: { select: { name: true, packageCategory: true } },
        assignedCoach: { select: { id: true, fullName: true } },
      },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'asc' }],
    });

    const activeSubs = subscriptions.filter(
      (sub) =>
        sub.status === 'ACTIVE' &&
        sub.startDate <= today &&
        (sub.endDate >= today || (sub.remainingPtSessions ?? 0) > 0),
    );
    const activeDisciplineIds = [
      ...new Set(activeSubs.map((sub) => sub.disciplineId).filter(Boolean)),
    ] as string[];
    const assignedCoachIds = [
      ...new Set(
        activeSubs
          .filter(
            (sub) =>
              sub.assignedCoachId &&
              ((sub.remainingPtSessions ?? 0) > 0 ||
                (sub.remainingGroupSessions ?? 0) > 0),
          )
          .map((sub) => sub.assignedCoachId!),
      ),
    ];
    const unassignedSubsWithQuota = activeSubs.filter(
      (sub) =>
        !sub.assignedCoachId &&
        Boolean((sub as any).coachRatingStars) &&
        Boolean(sub.disciplineId) &&
        ((sub.remainingGroupSessions ?? 0) > 0 ||
          (sub.remainingPtSessions ?? 0) > 0),
    );

    // Determine coach availability where condition matching ALL active packages (assigned PT + unassigned Group/PT)
    const availabilityOrClauses: any[] = [];
    if (assignedCoachIds.length > 0) {
      availabilityOrClauses.push({
        coachId: { in: assignedCoachIds },
        coach: { isActive: true },
      });
    }
    const seenDiscStars = new Set<string>();
    for (const sub of unassignedSubsWithQuota) {
      const stars = (sub as any).coachRatingStars as number;
      const discId = sub.disciplineId!;
      const key = `${discId}:${stars}`;
      if (seenDiscStars.has(key)) continue;
      seenDiscStars.add(key);
      availabilityOrClauses.push({
        coach: {
          isActive: true,
          coachProfile: {
            ratingStars: stars,
          },
          OR: [
            {
              coachProfile: {
                coachSpecialties: {
                  some: {
                    specialty: {
                      disciplineId: discId,
                    },
                  },
                },
              },
            },
            {
              coachRates: {
                some: {
                  disciplineId: discId,
                },
              },
            },
          ],
        },
      });
    }

    const availabilityWhere: any =
      availabilityOrClauses.length > 0
        ? {
            startTime: { gte: start, lt: end },
            isBooked: false,
            isEmergencyCancelled: false,
            ...(availabilityOrClauses.length === 1
              ? availabilityOrClauses[0]
              : { OR: availabilityOrClauses }),
          }
        : null;

    const [
      schedules,
      rawSlots,
      rawBookedSlotsInWeek,
      rawBookings,
      allDisciplines,
      allCoachProfiles,
      allCoachRates,
    ] = await Promise.all([
      view === 'pt' || view === 'mine'
        ? []
        : this.prisma.schedule.findMany({
            where: {
              startTime: { gte: start, lt: end },
              status: { in: ['OPEN', 'FULL'] },
              ...(disciplineId
                ? { class: { disciplineId } }
                : activeDisciplineIds.length > 0
                  ? { class: { disciplineId: { in: activeDisciplineIds } } }
                  : {}),
            },
            include: {
              class: { include: { discipline: true } },
              coach: {
                select: {
                  id: true,
                  fullName: true,
                  avatarUrl: true,
                  phone: true,
                  coachProfile: {
                    select: {
                      ratingStars: true,
                      yearsExperience: true,
                      specialties: true,
                    },
                  },
                },
              },
              room: true,
            },
            orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
          }),
      view === 'group' || view === 'mine' || !availabilityWhere
        ? []
        : this.prisma.coachAvailability.findMany({
            where: availabilityWhere,
            orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
          }),
      view === 'group' || view === 'mine'
        ? []
        : this.prisma.coachAvailability.findMany({
            where: {
              startTime: { gte: start, lt: end },
              isBooked: true,
              isEmergencyCancelled: false,
            },
            select: {
              id: true,
              coachId: true,
              startTime: true,
              endTime: true,
              bookings: {
                where: { status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] } },
                select: { disciplineId: true },
              },
            },
          }),
      this.prisma.booking.findMany({
        where: {
          memberId,
          status: { not: 'CANCELLED' },
          ...(disciplineId ? { disciplineId } : {}),
          OR: [
            { schedule: { startTime: { gte: start, lt: end } } },
            { coachAvailability: { startTime: { gte: start, lt: end } } },
          ],
        },
        include: {
          schedule: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              capacity: true,
              currentEnrolled: true,
              status: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  disciplineId: true,
                  discipline: { select: { id: true, code: true, name: true } },
                },
              },
              coach: {
                select: {
                  id: true,
                  fullName: true,
                  avatarUrl: true,
                  phone: true,
                  coachProfile: {
                    select: {
                      ratingStars: true,
                      yearsExperience: true,
                      specialties: true,
                    },
                  },
                },
              },
              room: { select: { id: true, name: true, capacity: true } },
            },
          },
          coachAvailability: {
            select: {
              id: true,
              coachId: true,
              startTime: true,
              endTime: true,
              isBooked: true,
            },
          },
          discipline: { select: { id: true, code: true, name: true } },
          subscription: {
            select: {
              id: true,
              planId: true,
              coachRatingStars: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  packageCategory: true,
                  discipline: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
          attendance: {
            select: { id: true, status: true, checkInTime: true },
          },
          workoutPlans: {
            take: 1,
            select: {
              id: true,
              title: true,
              notes: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [{ bookedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.discipline.findMany({
        select: { id: true, code: true, name: true },
      }),
      this.prisma.coachProfile.findMany({
        select: {
          userId: true,
          ratingStars: true,
          yearsExperience: true,
          user: {
            select: { id: true, fullName: true, avatarUrl: true, phone: true },
          },
          coachSpecialties: {
            select: {
              specialty: {
                select: { id: true, name: true, disciplineId: true },
              },
            },
          },
        },
      }),
      this.prisma.coachRate.findMany({
        select: { coachId: true, disciplineId: true },
      }),
    ]);

    const disciplineById = new Map(allDisciplines.map((d) => [d.id, d]));
    const ratesByCoachId = new Map<
      string,
      Array<{
        disciplineId: string | null;
        discipline: { id: string; code: string; name: string } | null;
      }>
    >();
    for (const rate of allCoachRates) {
      const list = ratesByCoachId.get(rate.coachId) ?? [];
      list.push({
        disciplineId: rate.disciplineId,
        discipline: rate.disciplineId
          ? (disciplineById.get(rate.disciplineId) ?? null)
          : null,
      });
      ratesByCoachId.set(rate.coachId, list);
    }

    const coachById = new Map<string, any>();
    for (const profile of allCoachProfiles) {
      coachById.set(profile.userId, {
        id: profile.user.id,
        fullName: profile.user.fullName,
        avatarUrl: profile.user.avatarUrl,
        phone: profile.user.phone,
        coachProfile: {
          ratingStars: profile.ratingStars,
          yearsExperience: profile.yearsExperience,
          coachSpecialties: profile.coachSpecialties.map((cs) => ({
            specialty: {
              ...cs.specialty,
              discipline: disciplineById.get(cs.specialty.disciplineId) ?? null,
            },
          })),
        },
        coachRates: ratesByCoachId.get(profile.userId) ?? [],
      });
    }

    const slots = rawSlots.map((slot) => ({
      ...slot,
      coach: coachById.get(slot.coachId) ?? null,
    }));
    const bookedSlotsInWeek = rawBookedSlotsInWeek.map((slot) => ({
      ...slot,
      coach: coachById.get(slot.coachId) ?? null,
    }));
    const bookings = rawBookings.map((booking) => ({
      ...booking,
      coachAvailability: booking.coachAvailability
        ? {
            ...booking.coachAvailability,
            coach: coachById.get(booking.coachAvailability.coachId) ?? null,
          }
        : null,
    }));

    // Collect active group subscriptions of member to determine allowed coach rating stars per discipline
    const activeGroupSubs = subscriptions.filter(
      (sub) =>
        sub.status === 'ACTIVE' &&
        sub.startDate <= today &&
        sub.endDate >= today &&
        (sub.remainingGroupSessions ?? 0) > 0,
    );

    // Map: disciplineId -> Set of allowed coach rating stars
    const disciplineAllowedStars = new Map<string, Set<number>>();
    for (const sub of activeGroupSubs) {
      const stars = (sub as any).coachRatingStars;
      if (sub.disciplineId && stars) {
        if (!disciplineAllowedStars.has(sub.disciplineId)) {
          disciplineAllowedStars.set(sub.disciplineId, new Set<number>());
        }
        disciplineAllowedStars.get(sub.disciplineId)!.add(stars);
      }
    }

    // Filter schedules: if member has active group subscription(s) for that discipline,
    // they will ONLY see schedules matching BOTH coach rating stars AND the course specialty of their plan!
    const visibleSchedules = schedules.filter((schedule) => {
      const discId = schedule.class.disciplineId;
      const matchingSubs = activeGroupSubs.filter((sub) => sub.disciplineId === discId);
      if (activeGroupSubs.length > 0 && matchingSubs.length === 0) {
        // If member has active group sub(s), do NOT display classes of non-owned disciplines
        return false;
      }
      if (matchingSubs.length === 0) {
        return activeSubs.length === 0;
      }

      const coachStars = schedule.coach?.coachProfile?.ratingStars ?? 3;
      return matchingSubs.some((sub) => {
        // 1. Star check
        const subStars = (sub as any).coachRatingStars;
        if (subStars && subStars !== coachStars) {
          return false;
        }

        // 2. Specialty / Topic check
        const comp = isClassCompatibleWithPlan(
          schedule.class.name,
          sub.plan.name,
          schedule.class.discipline?.code,
        );
        return comp.isCompatible;
      });
    });

    // Pre-index PT & Group bookings by (localDateMs:disciplineId) for O(1) day eligibility lookup
    const sameDayPtMap = new Map<string, typeof bookings>();
    const sameDayDisciplineMap = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      if (
        booking.bookingType === 'PERSONAL_TRAINING' &&
        booking.disciplineId &&
        booking.coachAvailability?.startTime
      ) {
        const key = `${localDate(booking.coachAvailability.startTime).getTime()}:${booking.disciplineId}`;
        const list = sameDayPtMap.get(key);
        if (list) list.push(booking);
        else sameDayPtMap.set(key, [booking]);
      }
      const startTime =
        booking.schedule?.startTime ?? booking.coachAvailability?.startTime;
      if (booking.disciplineId && startTime) {
        const key = `${localDate(startTime).getTime()}:${booking.disciplineId}`;
        const list = sameDayDisciplineMap.get(key);
        if (list) list.push(booking);
        else sameDayDisciplineMap.set(key, [booking]);
      }
    }

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday.getTime() + index * 86400000);
      const dateMs = date.getTime();
      const dateText = date.toISOString().slice(0, 10);
      const eligibility = subscriptions.map((sub) => {
        const gymActive =
          sub.status === 'ACTIVE' &&
          sub.startDate <= today &&
          sub.startDate <= date &&
          sub.endDate >= date &&
          sub.endDate >= today;

        const hasPtQuota = (sub.remainingPtSessions ?? 0) > 0;
        const ptActive = sub.status === 'ACTIVE' && sub.startDate <= today && hasPtQuota;

        const sameDayPt = sub.disciplineId
          ? (sameDayPtMap.get(`${dateMs}:${sub.disciplineId}`) ?? [])
          : [];
        const dayBlock = ptDayBlockReason(sameDayPt);

        const sameDayAll = sub.disciplineId
          ? (sameDayDisciplineMap.get(`${dateMs}:${sub.disciplineId}`) ?? [])
          : [];
        const hasActiveSameDay = sameDayAll.some(
          (b) => b.status !== 'CANCELLED',
        );

        return {
          subscriptionId: sub.id,
          disciplineId: sub.disciplineId,
          group: {
            allowed:
              gymActive &&
              (sub.remainingGroupSessions ?? 0) > 0 &&
              !hasActiveSameDay,
            reason: !gymActive
              ? 'SUBSCRIPTION_NOT_ACTIVE_ON_DAY'
              : (sub.remainingGroupSessions ?? 0) <= 0
                ? 'GROUP_QUOTA_EXHAUSTED'
                : hasActiveSameDay
                  ? 'GROUP_ALREADY_BOOKED_FOR_DISCIPLINE_DAY'
                  : null,
          },
          pt: {
            allowed: ptActive && !dayBlock,
            reason: !ptActive
              ? sub.status !== 'ACTIVE'
                ? 'SUBSCRIPTION_NOT_ACTIVE'
                : !hasPtQuota
                  ? 'PT_QUOTA_EXHAUSTED'
                  : 'SUBSCRIPTION_NOT_STARTED'
              : dayBlock,
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
      schedules: visibleSchedules.map((schedule) => {
        const roomCap = schedule.room?.capacity || 5;
        const finalCap = Math.min(schedule.capacity || 5, roomCap, 5);
        return {
          ...schedule,
          capacity: finalCap,
          type: 'GROUP_CLASS',
          startAt: schedule.startTime,
          endAt: schedule.endTime,
          disciplineId: schedule.class.disciplineId,
          coach: {
            id: schedule.coach.id,
            fullName: schedule.coach.fullName,
            avatarUrl: (schedule.coach as any).avatarUrl,
            phone: (schedule.coach as any).phone,
            ratingStars: schedule.coach.coachProfile?.ratingStars ?? 2,
            coachProfile: schedule.coach.coachProfile,
          },
        };
      }),
      ptSlots: slots
        .map((slot) => {
          const allCoachSpecs = ((slot.coach as any)?.coachProfile?.coachSpecialties || [])
            .map((cs: any) => cs.specialty)
            .filter(Boolean);
          const allCoachRates = ((slot.coach as any)?.coachRates || []).filter(Boolean);

          const coachRatingStars = (slot.coach as any)?.coachProfile?.ratingStars ?? 2;
          const coachSpecDiscIds = allCoachSpecs
            .map((sp: any) => sp.disciplineId)
            .filter(Boolean);
          const coachRateDiscIds = allCoachRates
            .map((cr: any) => cr.disciplineId)
            .filter(Boolean);
          const coachTaughtDiscIds = new Set([...coachSpecDiscIds, ...coachRateDiscIds]);

          const matchedMemberSubs = subscriptions.filter(
            (sub) =>
              sub.status === 'ACTIVE' &&
              ((sub.remainingGroupSessions ?? 0) > 0 ||
                (sub.remainingPtSessions ?? 0) > 0) &&
              (sub.assignedCoachId === slot.coachId ||
                (!sub.assignedCoachId &&
                  Boolean((sub as any).coachRatingStars) &&
                  (sub as any).coachRatingStars === coachRatingStars &&
                  Boolean(sub.disciplineId) &&
                  (!coachTaughtDiscIds.size ||
                    coachTaughtDiscIds.has(sub.disciplineId!)))),
          );

          const noteLower = String((slot as any).notes || '').toLowerCase();
          const preferredDiscId =
            disciplineId ||
            (noteLower.includes('yoga')
              ? allCoachSpecs.find((sp: any) => sp.discipline?.code === 'YOGA')?.disciplineId ||
                allCoachRates.find((cr: any) => cr.discipline?.code === 'YOGA')?.disciplineId
              : noteLower.includes('boxing') || noteLower.includes('kickboxing')
                ? allCoachSpecs.find((sp: any) => sp.discipline?.code === 'BOXING')?.disciplineId ||
                  allCoachRates.find((cr: any) => cr.discipline?.code === 'BOXING')?.disciplineId
                : undefined) ||
            matchedMemberSubs.find((s) => s.plan?.packageCategory === 'GROUP')?.disciplineId ||
            matchedMemberSubs[0]?.disciplineId;

          const coachSpec =
            allCoachSpecs.find((sp: any) => sp.disciplineId === preferredDiscId) ||
            allCoachSpecs[0] ||
            null;
          const coachRate =
            allCoachRates.find((cr: any) => cr.disciplineId === preferredDiscId) ||
            allCoachRates[0] ||
            null;

          const disciplineName =
            coachSpec?.discipline?.name || coachRate?.discipline?.name || 'Gym & Fitness';
          const disciplineCode =
            coachSpec?.discipline?.code || coachRate?.discipline?.code || 'GYM';
          const specialtyName = coachSpec?.name || null;

          const hasMatchingGroupSub = matchedMemberSubs.some(
            (s) =>
              (!preferredDiscId || s.disciplineId === preferredDiscId) &&
              (s.remainingGroupSessions ?? 0) > 0 &&
              (s.remainingPtSessions ?? 0) <= 0,
          );
          const isYogaOrBoxing = Boolean(
            disciplineName?.toLowerCase().includes('yoga') ||
              disciplineName?.toLowerCase().includes('boxing') ||
              disciplineCode?.toLowerCase().includes('yoga') ||
              disciplineCode?.toLowerCase().includes('box') ||
              specialtyName?.toLowerCase().includes('yoga') ||
              specialtyName?.toLowerCase().includes('boxing') ||
              hasMatchingGroupSub,
          );
          const packageCategory = isYogaOrBoxing ? 'GROUP' : 'ONE_ON_ONE';

          const resolvedDisciplineId =
            preferredDiscId || coachSpec?.disciplineId || coachRate?.disciplineId || null;

          const hasDuplicateBookedSlot =
            resolvedDisciplineId &&
            bookedSlotsInWeek.some((b) => {
              if (b.id === slot.id) return false;
              if (!(b.startTime < slot.endTime && b.endTime > slot.startTime)) return false;
              const bookedStars = b.coach?.coachProfile?.ratingStars ?? 2;
              if (bookedStars !== coachRatingStars) return false;
              const bookedDiscIds = new Set([
                ...(b.bookings || []).map((bk) => bk.disciplineId).filter(Boolean),
                ...(b.coach?.coachProfile?.coachSpecialties || [])
                  .map((cs: any) => cs.specialty?.disciplineId)
                  .filter(Boolean),
                ...(b.coach?.coachRates || []).map((cr: any) => cr.disciplineId).filter(Boolean),
              ]);
              return bookedDiscIds.has(resolvedDisciplineId);
            });

          return {
            ...slot,
            type: isYogaOrBoxing ? 'GROUP_CLASS' : 'PERSONAL_TRAINING',
            packageCategory,
            disciplineName,
            disciplineCode,
            specialtyName,
            startAt: slot.startTime,
            endAt: slot.endTime,
            coach: {
              ...slot.coach,
              ratingStars: coachRatingStars,
            },
            coachRatingStars,
            hasDuplicateBookedSlot: Boolean(hasDuplicateBookedSlot),
            eligibleDisciplines: [
              ...new Set(matchedMemberSubs.map((sub) => sub.disciplineId)),
            ],
          };
        })
        .filter((slot) => slot.eligibleDisciplines.length > 0 && !slot.hasDuplicateBookedSlot),
      bookings: bookings.map((booking) => {
        const coachSpec = (booking.coachAvailability as any)?.coach?.coachProfile?.coachSpecialties?.[0]?.specialty;
        const coachRates = (booking.coachAvailability as any)?.coach?.coachRates?.[0];
        const subPlan = booking.subscription?.plan;
        const discName =
          coachSpec?.discipline?.name ||
          coachRates?.discipline?.name ||
          booking.discipline?.name ||
          subPlan?.discipline?.name ||
          '';
        const discCode =
          coachSpec?.discipline?.code ||
          coachRates?.discipline?.code ||
          booking.discipline?.code ||
          subPlan?.discipline?.code ||
          '';
        const isYogaOrBoxing = Boolean(
          discName.toLowerCase().includes('yoga') ||
          discName.toLowerCase().includes('boxing') ||
          discCode.toLowerCase().includes('yoga') ||
          discCode.toLowerCase().includes('box') ||
          subPlan?.name?.toLowerCase().includes('yoga') ||
          subPlan?.name?.toLowerCase().includes('boxing') ||
          subPlan?.packageCategory === 'GROUP' ||
          (booking.subscription as any)?.packageCategory === 'GROUP'
        );
        const isPt =
          booking.bookingType === 'PERSONAL_TRAINING' ||
          (!isYogaOrBoxing && Boolean(booking.coachAvailabilityId || (booking as any).coachId));
        const packageCategory = isPt
          ? 'ONE_ON_ONE'
          : isYogaOrBoxing
          ? 'GROUP'
          : ((booking.subscription as any)?.packageCategory ??
              subPlan?.packageCategory ??
              (booking.schedule ? 'GROUP' : 'ONE_ON_ONE'));

        const assignedCoach =
          (booking.coachAvailability as any)?.coach ||
          (booking as any).coach ||
          booking.schedule?.coach ||
          null;
        const coachRatingStars =
          assignedCoach?.coachProfile?.ratingStars ??
          (booking.subscription as any)?.coachRatingStars ??
          2;

        return {
          ...booking,
          coach: assignedCoach
            ? {
                id: assignedCoach.id,
                fullName: assignedCoach.fullName,
                avatarUrl: (assignedCoach as any).avatarUrl,
                phone: (assignedCoach as any).phone,
                ratingStars: coachRatingStars,
                coachProfile: assignedCoach.coachProfile,
              }
            : null,
          coachRatingStars,
          startAt:
            booking.schedule?.startTime ?? booking.coachAvailability?.startTime,
          endAt: booking.schedule?.endTime ?? booking.coachAvailability?.endTime,
          workoutPlans: (booking as any).workoutPlans || [],
          discipline:
            booking.discipline ||
            (coachSpec ? coachSpec.discipline : null) ||
            (coachRates ? coachRates.discipline : null) ||
            (booking.schedule?.class ? (booking.schedule.class as any).discipline : null) ||
            subPlan?.discipline ||
            {
              id: 'bb47d3e8-3ad6-4ea3-9b42-71362b8ee962',
              name: 'Gym & Fitness',
              code: 'GYM',
            },
          packageCategory,
          subscription: booking.subscription
            ? {
                ...booking.subscription,
                planName: booking.subscription.plan?.name,
                packageCategory,
              }
            : null,
        };
      }),
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        disciplineId: sub.disciplineId,
        planName: sub.plan.name,
        packageCategory: (sub as any).packageCategory ?? sub.plan?.packageCategory ?? null,
        packageTier: sub.packageTier,
        coachRatingStars: (sub as any).coachRatingStars ?? null,
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
