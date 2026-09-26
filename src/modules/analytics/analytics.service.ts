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
}
