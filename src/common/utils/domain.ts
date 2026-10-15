import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { Actor } from '../types/actor';

export function requireRecord<T>(
  value: T | null,
  code = 'RESOURCE_NOT_FOUND',
): T {
  if (value === null) throw new NotFoundException(code);
  return value;
}

export function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new BadRequestException(code);
}

export function requireOwner(actor: Actor, ownerId: string) {
  if (actor.userId !== ownerId)
    throw new ForbiddenException('FORBIDDEN_RESOURCE');
}

export function localDate(now = new Date()): Date {
  return new Date(
    `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)}T00:00:00Z`,
  );
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

export function timeRange(start: Date, end: Date) {
  requireCondition(end > start, 'INVALID_TIME_RANGE');
}

export async function requireRole(
  tx: Prisma.TransactionClient,
  id: string,
  role: UserRole,
) {
  const user = requireRecord(
    await tx.user.findUnique({ where: { id } }),
    'USER_NOT_FOUND',
  );
  requireCondition(
    user.role === role && user.isActive,
    'INVALID_USER_ROLE_OR_INACTIVE',
  );
  return user;
}

export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  entity: string,
  id: string,
  data?: object,
) {
  await tx.auditLog.create({
    data: {
      userId: actor.userId,
      action,
      targetEntity: entity,
      targetId: id,
      afterState: data
        ? (JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

export async function memberAccess(
  tx: Prisma.TransactionClient,
  actor: Actor,
  memberId: string,
) {
  if (actor.role === UserRole.MEMBER) return requireOwner(actor, memberId);
  if (actor.role === UserRole.COACH) {
    const today = localDate();
    const assigned = await tx.userSubscription.findFirst({
      where: {
        userId: memberId,
        assignedCoachId: actor.userId,
        status: 'ACTIVE',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });
    if (!assigned) throw new ForbiddenException('MEMBER_NOT_ASSIGNED_TO_COACH');
  }
}
