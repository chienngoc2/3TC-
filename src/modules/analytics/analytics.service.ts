import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { localDate, addDays } from '../../common/utils/domain';
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}
  async revenue() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        code: string;
        total: Prisma.Decimal;
        base: Prisma.Decimal;
        pt: Prisma.Decimal;
      }>
    >`SELECT COALESCE(d.code, 'UNSPECIFIED') AS code, SUM(i.amount) AS total, SUM(COALESCE(i.base_amount,0)) AS base, SUM(COALESCE(i.pt_amount,0)) AS pt FROM invoices i JOIN user_subscriptions s ON s.id = i.subscription_id LEFT JOIN disciplines d ON d.id = s.discipline_id WHERE i.status = 'PAID' GROUP BY d.code`;
    let total = new Prisma.Decimal(0),
      base = total,
      pt = total;
    const byDiscipline: Record<string, number> = {};
    for (const row of rows) {
      total = total.add(row.total);
      base = base.add(row.base);
      pt = pt.add(row.pt);
      byDiscipline[row.code] = Number(row.total);
    }
    return {
      totalRevenue: Number(total),
      baseRevenue: Number(base),
      ptRevenue: Number(pt),
      byDiscipline,
    };
  }
  async summary() {
    const start = new Date(localDate().getTime() - 7 * 3600000),
      end = addDays(start, 1);
    const [sales, members, gateEntries, schedules, pendingCancellations] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: { status: 'PAID', createdAt: { gte: start, lt: end } },
          _sum: { amount: true },
        }),
        this.prisma.user.count({
          where: { role: 'MEMBER', createdAt: { gte: start, lt: end } },
        }),
        this.prisma.attendance.count({
          where: {
            checkinType: 'GATE_ENTRY',
            checkInTime: { gte: start, lt: end },
          },
        }),
        this.prisma.schedule.aggregate({
          where: {
            startTime: { gte: start, lt: end },
            status: { in: ['OPEN', 'FULL', 'COMPLETED'] },
          },
          _sum: { capacity: true, currentEnrolled: true },
        }),
        this.prisma.cancellationRequest.count({ where: { status: 'PENDING' } }),
      ]);
    return {
      date: localDate().toISOString().slice(0, 10),
      dailyRevenue: Number(sales._sum.amount ?? 0),
      newMembers: members,
      gateEntries,
      pendingCancellations,
      occupancyRate: schedules._sum.capacity
        ? (schedules._sum.currentEnrolled ?? 0) / schedules._sum.capacity
        : 0,
    };
  }
  async kpi() {
    const [coaches, rooms] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'COACH' },
        select: {
          id: true,
          fullName: true,
          _count: {
            select: { coachedSchedules: true, coachAvailabilities: true },
          },
          coachProfile: {
            select: {
              monthlyEmergencyCancellations: true,
              emergencyCancellationCount: true,
            },
          },
        },
      }),
      this.prisma.room.findMany({
        select: {
          id: true,
          name: true,
          schedules: {
            select: { startTime: true, endTime: true, status: true },
          },
        },
      }),
    ]);
    return {
      coaches,
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        totalScheduledHours: room.schedules
          .filter((s) => s.status !== 'CANCELLED_BY_COACH')
          .reduce(
            (sum, s) =>
              sum + (s.endTime.getTime() - s.startTime.getTime()) / 3600000,
            0,
          ),
      })),
    };
  }

  async topPlans() {
    const thirtyDaysAgo = addDays(localDate(), -30);
    const rows = await this.prisma.invoice.groupBy({
      by: ['subscriptionId'],
      where: {
        status: 'PAID',
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const subIds = rows.map((r) => r.subscriptionId);
    const subs = await this.prisma.userSubscription.findMany({
      where: { id: { in: subIds } },
      include: { plan: { include: { discipline: true } } },
    });

    const planAgg = new Map<
      string,
      {
        planId: string;
        planName: string;
        discipline: string;
        tier: string;
        salesCount: number;
        totalRevenue: number;
      }
    >();

    for (const r of rows) {
      const sub = subs.find((s) => s.id === r.subscriptionId);
      if (!sub?.plan) continue;
      const existing = planAgg.get(sub.plan.id) ?? {
        planId: sub.plan.id,
        planName: sub.plan.name,
        discipline: sub.plan.discipline?.code ?? 'GENERAL',
        tier: sub.plan.packageTier,
        salesCount: 0,
        totalRevenue: 0,
      };
      existing.salesCount += r._count.id;
      existing.totalRevenue += Number(r._sum.amount ?? 0);
      planAgg.set(sub.plan.id, existing);
    }

    return Array.from(planAgg.values())
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5);
  }

  async topCoaches() {
    const today = localDate();
    const coaches = await this.prisma.user.findMany({
      where: { role: 'COACH', isActive: true },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        coachRates: {
          where: {
            effectiveFrom: { lte: today },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            coachedSchedules: { where: { status: 'COMPLETED' } },
            bookings: { where: { status: 'ATTENDED' } },
          },
        },
      },
    });

    return coaches
      .map((c) => ({
        coachId: c.id,
        fullName: c.fullName,
        avatarUrl: c.avatarUrl,
        currentRate: Number(c.coachRates[0]?.ratePerSession ?? 0),
        completedClasses: c._count.coachedSchedules,
      }))
      .sort((a, b) => b.currentRate - a.currentRate)
      .slice(0, 3);
  }

  async dssSummary() {
    const [pendingCancellations, pendingPenalties, flaggedCoaches] =
      await Promise.all([
        this.prisma.cancellationRequest.count({
          where: { status: 'PENDING' },
        }),
        this.prisma.coachPenalty.count({
          where: { isReviewedByManager: false },
        }),
        this.prisma.coachProfile.findMany({
          where: { monthlyEmergencyCancellations: { gte: 2 } },
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        }),
      ]);

    return {
      pendingCancellationRequests: pendingCancellations,
      unreviewedPenalties: pendingPenalties,
      flaggedCoaches: flaggedCoaches.map((p) => ({
        coachId: p.userId,
        fullName: p.user.fullName,
        phone: p.user.phone,
        monthlyEmergencyCancellations: p.monthlyEmergencyCancellations,
        lifetimeEmergencyCancellations: p.emergencyCancellationCount,
        recommendation:
          p.monthlyEmergencyCancellations >= 3
            ? 'CRITICAL_REVIEW_RATE_REDUCTION'
            : 'WARNING_ADVISORY',
      })),
    };
  }
}
