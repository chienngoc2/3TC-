import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import { audit, requireRecord, requireCondition, requireOwner, requireRole, timeRange, localDate } from '../../common/utils/domain';
import { SlotDto, RateDto } from '../operations/dto/operations.dto';
@Injectable()
export class CoachesService {
  constructor(private readonly prisma: PrismaService, private readonly transactions: TransactionService) {}
  list() { return this.prisma.user.findMany({ where: { role: UserRole.COACH, isActive: true }, select: { id: true, fullName: true, avatarUrl: true, coachProfile: { include: { coachSpecialties: { include: { specialty: true } } } }, coachRates: true } }); }
  slots(coachId?: string) { return this.prisma.coachAvailability.findMany({ where: { coachId, isBooked: false, isEmergencyCancelled: false, startTime: { gt: new Date() }, coach: { isActive: true } }, orderBy: { startTime: 'asc' }, take: 200 }); }
  rates(coachId: string) { return this.prisma.coachRate.findMany({ where: { coachId }, orderBy: { effectiveFrom: 'desc' } }); }
  createRate(coachId: string, dto: RateDto, actor: Actor) { return this.transactions.run(async tx => {
    await requireRole(tx, coachId, UserRole.COACH);
    const effectiveFrom = new Date(dto.effectiveFrom), effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    requireCondition(!effectiveTo || effectiveTo >= effectiveFrom, 'INVALID_RATE_RANGE');
    const value = await tx.coachRate.create({ data: { coachId, ratePerSession: dto.ratePerSession, effectiveFrom, effectiveTo } });
    await audit(tx, actor, 'CREATE_COACH_RATE', 'coach_rates', value.id); return value;
  }); }
  createSlot(dto: SlotDto, actor: Actor) { return this.transactions.run(async tx => {
    await requireRole(tx, actor.userId, UserRole.COACH);
    const startTime = new Date(dto.startTime), endTime = new Date(dto.endTime); timeRange(startTime, endTime);
    requireCondition(startTime > new Date(), 'SLOT_MUST_BE_FUTURE');
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.userId}))`;
    const value = await tx.coachAvailability.create({ data: { coachId: actor.userId, startTime, endTime } });
    await audit(tx, actor, 'CREATE_PT_SLOT', 'coach_availability', value.id); return value;
  }); }
  deleteSlot(id: string, actor: Actor) { return this.transactions.run(async tx => {
    const slot = requireRecord(await tx.coachAvailability.findUnique({ where: { id } })); requireOwner(actor, slot.coachId);
    requireCondition(!slot.isBooked, 'SLOT_ALREADY_BOOKED');
    // Historical slots are retained so bookings/attendance cannot cascade away.
    if (await tx.booking.count({ where: { coachAvailabilityId: id } })) await tx.coachAvailability.update({ where: { id }, data: { isEmergencyCancelled: true } });
    else await tx.coachAvailability.delete({ where: { id } });
    await audit(tx, actor, 'REMOVE_PT_SLOT', 'coach_availability', id); return { id };
  }); }
  schedule(actor: Actor) { return Promise.all([this.prisma.schedule.findMany({ where: { coachId: actor.userId, startTime: { gte: localDate() } }, include: { class: true } }), this.prisma.coachAvailability.findMany({ where: { coachId: actor.userId, startTime: { gte: localDate() }, isBooked: true }, include: { bookings: { where: { status: 'CONFIRMED' } } } })]).then(([classes, pt]) => ({ classes, pt })); }
}
