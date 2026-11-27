import { Injectable, BadRequestException } from '@nestjs/common';
import { PackageTier } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  requireRecord,
  requireCondition,
  audit,
  localDate,
  addDays,
  memberAccess,
} from '../../common/utils/domain';
import {
  PlanDto,
  UpdatePlanDto,
  SubscriptionStatusDto,
} from '../commerce/dto/commerce.dto';
import { sortSubscriptionsByPriority } from '../attendances/subscription-priority.util';
function cleanPlanCourseName(name: string): string {
  return name.replace(/\s*\(\s*\d+\s*buổi[^)]*\)/i, '').trim();
}

function generateSpecialtyCode(disciplineCode: string, courseName: string): string {
  const clean = courseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const prefix = `SPEC_${disciplineCode.toUpperCase()}_`;
  const raw = `${prefix}${clean}`;
  return raw.length > 50 ? raw.slice(0, 50) : raw;
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list(disciplineId?: string, packageTier?: PackageTier) {
    return this.prisma.membershipPlan.findMany({
      where: { isActive: true, disciplineId, packageTier },
      include: {
        discipline: {
          include: {
            classes: true,
          },
        },
        curriculumRequirements: true,
        room: true,
      },
      orderBy: { price: 'asc' },
    });
  }
  async getPlanDetail(id: string) {
    return requireRecord(
      await this.prisma.membershipPlan.findUnique({
        where: { id },
        include: {
          discipline: {
            include: {
              classes: true,
            },
          },
          curriculumRequirements: true,
          room: true,
        },
      }),
      'PLAN_NOT_FOUND',
    );
  }
  async validate(
    tx: import('@prisma/client').Prisma.TransactionClient,
    dto: PlanDto,
    currentPlanId?: string,
  ) {
    const discipline = requireRecord(
      await tx.discipline.findUnique({ where: { id: dto.disciplineId } }),
    );
    requireCondition(
      discipline.code.toUpperCase() !== 'GYM' ||
        (dto.trainingMode !== 'GROUP_CLASS' && dto.groupSessionQuota === 0),
      'GYM_GROUP_PLAN_FORBIDDEN',
    );
    requireCondition(
      !dto.unlimitedGymEntry || discipline.code.toUpperCase() === 'GYM',
      'UNLIMITED_ACCESS_GYM_ONLY',
    );
    requireCondition(
      dto.packageTier !== 'VIP' || dto.ptSessionQuota === 12,
      'VIP_REQUIRES_12_PT_SESSIONS',
    );
    requireCondition(
      dto.packageTier !== 'TRIAL' ||
        (dto.price === 0 && dto.ptSessionQuota === 0),
      'INVALID_TRIAL_PLAN',
    );
    const isGym = discipline.code.toUpperCase() === 'GYM';
    if (isGym) {
      requireCondition(!dto.roomId, 'GYM_ROOM_SELECTION_FORBIDDEN');
    } else if (dto.roomId) {
      const room = requireRecord(
        await tx.room.findUnique({
          where: { id: dto.roomId },
          include: { discipline: true },
        }),
        'ROOM_NOT_FOUND',
      );
      requireCondition(room.isActive, 'ROOM_INACTIVE');

      // 1. Ràng buộc nhãn bộ môn - Không được chọn chéo phòng giữa các môn
      if (room.disciplineId && room.disciplineId !== dto.disciplineId) {
        throw new BadRequestException(
          `Phòng "${room.name}" thuộc bộ môn ${room.discipline?.name || 'khác'}, không thể gán cho gói tập ${discipline.name}! Mỗi bộ môn chỉ được chọn phòng có nhãn tương ứng.`,
        );
      }
      const roomNameLower = room.name.toLowerCase();
      const isYogaRoom = roomNameLower.includes('yoga');
      const isBoxingRoom = roomNameLower.includes('box');
      const isYogaPlan = discipline.code.toUpperCase() === 'YOGA';
      const isBoxingPlan = discipline.code.toUpperCase() === 'BOXING';
      if (isYogaPlan && isBoxingRoom) {
        throw new BadRequestException(
          `Phòng "${room.name}" là phòng Boxing, không thể gán cho gói tập Yoga!`,
        );
      }
      if (isBoxingPlan && isYogaRoom) {
        throw new BadRequestException(
          `Phòng "${room.name}" là phòng Yoga, không thể gán cho gói tập Boxing!`,
        );
      }

      // 2. Ràng buộc 1 phòng - 1 gói duy nhất: Phòng đã có gói khác đăng ký thì không cho chọn tiếp
      const existingPlan = await tx.membershipPlan.findFirst({
        where: {
          roomId: dto.roomId,
          isActive: true,
          ...(currentPlanId ? { id: { not: currentPlanId } } : {}),
        },
      });
      if (existingPlan) {
        throw new BadRequestException(
          `Phòng "${room.name}" đã được book bởi gói "${existingPlan.name}". Mỗi phòng chỉ dành riêng cho 1 gói tập duy nhất!`,
        );
      }
    }
  }
  create(dto: PlanDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await this.validate(tx, dto);
      const discipline = await tx.discipline.findUnique({ where: { id: dto.disciplineId } });
      const isGym = discipline?.code.toUpperCase() === 'GYM';
      const value = await tx.membershipPlan.create({
        data: {
          ...dto,
          roomId: isGym ? null : (dto.roomId || null),
          sessionQuota: dto.groupSessionQuota + dto.ptSessionQuota,
        },
      });

      // Tự động đồng bộ Chuyên môn (Specialty) cho gói khóa học lớp nhóm (Yoga / Boxing)
      if (
        !isGym &&
        discipline &&
        (dto.trainingMode === 'GROUP_CLASS' || dto.packageTier === 'PLUS')
      ) {
        const cleanName = cleanPlanCourseName(dto.name);
        const existingSpec = await tx.specialty.findFirst({
          where: {
            disciplineId: dto.disciplineId,
            OR: [
              { name: { equals: cleanName, mode: 'insensitive' } },
              { name: { equals: dto.name, mode: 'insensitive' } },
            ],
          },
        });

        if (!existingSpec) {
          let code = generateSpecialtyCode(discipline.code, cleanName);
          const conflict = await tx.specialty.findUnique({ where: { code } });
          if (conflict) {
            code = `${code.slice(0, 44)}_${Date.now().toString().slice(-5)}`;
          }
          await tx.specialty.create({
            data: {
              disciplineId: dto.disciplineId,
              code,
              name: cleanName,
              description: dto.description || `Chuyên đề khóa học lớp nhóm: ${cleanName}`,
            },
          });
        }
      }

      await audit(tx, actor, 'CREATE_PLAN', 'membership_plans', value.id);
      return value;
    });
  }
  update(id: string, dto: UpdatePlanDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const old = requireRecord(
        await tx.membershipPlan.findUnique({ where: { id } }),
      );
      // Existing contracts retain their entitlements; their identifying discipline/tier cannot change.
      requireCondition(
        !dto.disciplineId || dto.disciplineId === old.disciplineId,
        'PLAN_DISCIPLINE_IMMUTABLE',
      );
      requireCondition(
        !dto.packageTier || dto.packageTier === old.packageTier,
        'PLAN_TIER_IMMUTABLE',
      );
      const data = {
        ...old,
        price: Number(old.price),
        groupSessionQuota: old.groupSessionQuota ?? 0,
        ptSessionQuota: old.ptSessionQuota ?? 0,
        unlimitedGymEntry: old.unlimitedGymEntry ?? false,
        ...dto,
      } as PlanDto;
      await this.validate(tx, data, id);
      const discipline = old.disciplineId
        ? await tx.discipline.findUnique({ where: { id: old.disciplineId } })
        : null;
      const isGym = discipline?.code.toUpperCase() === 'GYM';
      const value = await tx.membershipPlan.update({
        where: { id },
        data: {
          ...dto,
          roomId: isGym ? null : (dto.roomId !== undefined ? dto.roomId : old.roomId),
          sessionQuota: data.groupSessionQuota + data.ptSessionQuota,
        },
      });

      // Tự động đồng bộ cập nhật tên Chuyên môn nếu tên gói thay đổi
      if (!isGym && old.disciplineId && dto.name && dto.name !== old.name) {
        const oldClean = cleanPlanCourseName(old.name);
        const newClean = cleanPlanCourseName(dto.name);
        if (oldClean !== newClean) {
          const matchingSpec = await tx.specialty.findFirst({
            where: {
              disciplineId: old.disciplineId,
              OR: [
                { name: { equals: oldClean, mode: 'insensitive' } },
                { name: { equals: old.name, mode: 'insensitive' } },
              ],
            },
          });
          if (matchingSpec) {
            await tx.specialty.update({
              where: { id: matchingSpec.id },
              data: {
                name: newClean,
                ...(dto.description ? { description: dto.description } : {}),
              },
            });
          }
        }
      }

      await audit(tx, actor, 'UPDATE_PLAN', 'membership_plans', id, dto);
      return value;
    });
  }
  disable(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      requireRecord(await tx.membershipPlan.findUnique({ where: { id } }));
      const value = await tx.membershipPlan.update({
        where: { id },
        data: { isActive: false },
      });
      await audit(tx, actor, 'DISABLE_PLAN', 'membership_plans', id);
      return value;
    });
  }
  subscriptions(memberId: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await memberAccess(tx, actor, memberId);
      const list = await tx.userSubscription.findMany({
        where: { userId: memberId },
        include: {
          plan: {
            include: {
              discipline: true,
            },
          },
          discipline: true,
          assignedCoach: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              phone: true,
              coachProfile: {
                select: {
                  ratingStars: true,
                  ratePerSession: true,
                  workingDays: true,
                  workingHours: true,
                  bio: true,
                  specialties: true,
                },
              },
            },
          },
          bookings: {
            where: { status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] } },
            select: { id: true, bookingType: true },
          },
        },
        orderBy: { endDate: 'asc' },
      });
      const enriched = list.map(({ bookings, ...sub }) => {
        const usedGroupSessions = (bookings || []).filter(
          (b) => b.bookingType === 'GROUP_CLASS',
        ).length;
        const usedPtSessions = (bookings || []).filter(
          (b) => b.bookingType === 'PERSONAL_TRAINING',
        ).length;
        return {
          ...sub,
          usedGroupSessions,
          usedPtSessions,
        };
      });
      return sortSubscriptionsByPriority(enriched);
    });
  }

  async eligibleCoaches(subscriptionId: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const sub = requireRecord(
        await tx.userSubscription.findUnique({
          where: { id: subscriptionId },
          include: {
            plan: { include: { discipline: true } },
            discipline: true,
            assignedCoach: { include: { coachProfile: true } },
          },
        }),
        'SUBSCRIPTION_NOT_FOUND',
      );
      await memberAccess(tx, actor, sub.userId);
      requireCondition(sub.status === 'ACTIVE', 'SUBSCRIPTION_NOT_ACTIVE');
      requireCondition(
        Boolean(sub.assignedCoachId),
        'NO_ASSIGNED_COACH_TO_CHANGE',
      );

      const currentCoachStars =
        sub.coachRatingStars ??
        sub.assignedCoach?.coachProfile?.ratingStars ??
        3;

      const candidateCoaches = await tx.user.findMany({
        where: {
          id: { not: sub.assignedCoachId! },
          role: 'COACH',
          isActive: true,
          coachProfile: {
            ratingStars: currentCoachStars,
          },
          ...(sub.disciplineId
            ? {
                coachProfile: {
                  ratingStars: currentCoachStars,
                  coachSpecialties: {
                    some: {
                      specialty: {
                        disciplineId: sub.disciplineId,
                      },
                    },
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          phone: true,
          coachProfile: {
            select: {
              ratingStars: true,
              ratePerSession: true,
              workingDays: true,
              workingHours: true,
              bio: true,
              specialties: true,
            },
          },
          coachAvailabilities: {
            where: {
              startTime: { gt: new Date() },
              isEmergencyCancelled: false,
            },
            orderBy: { startTime: 'asc' },
            take: 20,
            select: {
              id: true,
              startTime: true,
              endTime: true,
              isBooked: true,
            },
          },
        },
      });

      return {
        subscriptionId: sub.id,
        currentCoach: {
          id: sub.assignedCoach?.id,
          fullName: sub.assignedCoach?.fullName,
          ratingStars: currentCoachStars,
          ratePerSession: currentCoachStars * 1000,
        },
        targetStars: currentCoachStars,
        eligibleCoaches: candidateCoaches,
      };
    });
  }

  async changeCoach(subscriptionId: string, newCoachId: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const sub = requireRecord(
        await tx.userSubscription.findUnique({
          where: { id: subscriptionId },
          include: {
            assignedCoach: { include: { coachProfile: true } },
          },
        }),
        'SUBSCRIPTION_NOT_FOUND',
      );
      await memberAccess(tx, actor, sub.userId);
      requireCondition(sub.status === 'ACTIVE', 'SUBSCRIPTION_NOT_ACTIVE');
      requireCondition(
        Boolean(sub.assignedCoachId),
        'NO_ASSIGNED_COACH_TO_CHANGE',
      );
      requireCondition(
        sub.assignedCoachId !== newCoachId,
        'ALREADY_ASSIGNED_TO_THIS_COACH',
      );

      const newCoach = requireRecord(
        await tx.user.findUnique({
          where: { id: newCoachId },
          include: { coachProfile: true },
        }),
        'COACH_NOT_FOUND',
      );
      requireCondition(
        newCoach.role === 'COACH' && newCoach.isActive,
        'COACH_UNAVAILABLE',
      );

      const currentCoachStars =
        sub.coachRatingStars ??
        sub.assignedCoach?.coachProfile?.ratingStars ??
        3;
      const newCoachStars = newCoach.coachProfile?.ratingStars ?? 3;

      requireCondition(
        currentCoachStars === newCoachStars,
        `Chỉ được đổi sang huấn luyện viên có cùng hạng ${currentCoachStars} sao (${(currentCoachStars * 1000).toLocaleString('vi-VN')} đ/buổi - ngang giá tiền).`,
      );

      if (sub.disciplineId) {
        const expertise = await tx.coachSpecialty.findFirst({
          where: {
            coachProfile: { userId: newCoachId },
            specialty: { disciplineId: sub.disciplineId },
          },
        });
        requireCondition(
          Boolean(expertise),
          'Huấn luyện viên được chọn không phụ trách bộ môn của gói tập này.',
        );
      }

      const updated = await tx.userSubscription.update({
        where: { id: subscriptionId },
        data: {
          assignedCoachId: newCoachId,
          assigned_coach_name: newCoach.fullName,
          coachRatingStars: newCoachStars,
        },
        include: {
          assignedCoach: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              coachProfile: true,
            },
          },
        },
      });

      await audit(
        tx,
        actor,
        'CHANGE_COACH',
        'user_subscriptions',
        subscriptionId,
        {
          oldCoachId: sub.assignedCoachId,
          newCoachId,
          starRating: newCoachStars,
        },
      );

      return updated;
    });
  }
  status(id: string, dto: SubscriptionStatusDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const sub = requireRecord(
        await tx.userSubscription.findUnique({ where: { id } }),
      );
      requireCondition(
        dto.status === 'FROZEN' || dto.status === 'ACTIVE',
        'INVALID_MANUAL_STATUS',
      );
      const today = localDate();
      let endDate = sub.endDate;
      if (dto.status === 'FROZEN')
        requireCondition(
          sub.status === 'ACTIVE' &&
            sub.startDate <= today &&
            sub.endDate >= today,
          'SUBSCRIPTION_NOT_FREEZABLE',
        );
      else {
        requireCondition(
          sub.status === 'FROZEN' && sub.frozenAt,
          'SUBSCRIPTION_NOT_FROZEN',
        );
        endDate = addDays(
          endDate,
          Math.max(
            0,
            Math.floor(
              (today.getTime() - localDate(sub.frozenAt).getTime()) / 86400000,
            ),
          ),
        );
      }
      const value = await tx.userSubscription.update({
        where: { id },
        data: {
          status: dto.status,
          frozenAt: dto.status === 'FROZEN' ? new Date() : null,
          endDate,
        },
      });
      await audit(
        tx,
        actor,
        'CHANGE_SUBSCRIPTION_STATUS',
        'user_subscriptions',
        id,
        dto,
      );
      return value;
    });
  }
}
