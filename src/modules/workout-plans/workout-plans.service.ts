import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  memberAccess,
  requireOwner,
  requireRecord,
  audit,
  requireRole,
} from '../../common/utils/domain';
import {
  WorkoutDto,
  UpdateWorkoutDto,
  KnowledgeDto,
  AssignTemplateDto,
} from './dto/workout.dto';
import { UserRole } from '@prisma/client';
@Injectable()
export class WorkoutPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list(actor: Actor) {
    return this.prisma.workoutPlan.findMany({
      where:
        actor.role === 'MEMBER'
          ? { memberId: actor.userId }
          : actor.role === 'COACH'
            ? { coachId: actor.userId }
            : {},
      include: {
        exercises: {
          include: { exercise: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  create(dto: WorkoutDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, dto.memberId, 'MEMBER');
      await memberAccess(tx, actor, dto.memberId);
      const { exercises, ...data } = dto;
      const value = await tx.workoutPlan.create({
        data: {
          ...data,
          coachId: actor.userId,
          exercises: {
            create: exercises.map((exercise, orderIndex) => ({
              ...exercise,
              orderIndex,
            })),
          },
        },
        include: { exercises: true },
      });
      await audit(tx, actor, 'CREATE_WORKOUT_PLAN', 'workout_plans', value.id);
      return { ...value, totalExercises: value.exercises.length };
    });
  }
  update(id: string, dto: UpdateWorkoutDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const old = requireRecord(
        await tx.workoutPlan.findUnique({ where: { id } }),
      );
      requireOwner(actor, old.coachId);
      await memberAccess(tx, actor, old.memberId);
      const { exercises, ...data } = dto;
      if (exercises)
        await tx.workoutExercise.deleteMany({ where: { workoutPlanId: id } });
      const value = await tx.workoutPlan.update({
        where: { id },
        data: {
          ...data,
          ...(exercises
            ? {
                exercises: {
                  create: exercises.map((exercise, orderIndex) => ({
                    ...exercise,
                    orderIndex,
                  })),
                },
              }
            : {}),
        },
        include: { exercises: true },
      });
      await audit(tx, actor, 'UPDATE_WORKOUT_PLAN', 'workout_plans', id);
      return value;
    });
  }
  delete(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const old = requireRecord(
        await tx.workoutPlan.findUnique({ where: { id } }),
      );
      requireOwner(actor, old.coachId);
      await tx.workoutPlan.delete({ where: { id } });
      await audit(tx, actor, 'DELETE_WORKOUT_PLAN', 'workout_plans', id);
      return { id };
    });
  }
  knowledge() {
    return this.prisma.exerciseKnowledge.findMany({
      take: 200,
      orderBy: { title: 'asc' },
    });
  }
  createKnowledge(dto: KnowledgeDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const value = await tx.exerciseKnowledge.create({ data: dto });
      await audit(
        tx,
        actor,
        'CREATE_EXERCISE_KNOWLEDGE',
        'exercise_knowledge',
        value.id,
      );
      return value;
    });
  }

  templates(discipline?: string) {
    return (this.prisma as any).workoutTemplate.findMany({
      where: discipline
        ? {
            disciplineCode: {
              equals: discipline,
              mode: 'insensitive',
            },
          }
        : {},
      include: {
        exercises: {
          include: { exercise: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: [{ disciplineCode: 'asc' }, { sessionOrder: 'asc' }],
    });
  }

  assignTemplate(dto: AssignTemplateDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const booking = requireRecord(
        await tx.booking.findUnique({
          where: { id: dto.bookingId },
          include: {
            coachAvailability: true,
            schedule: true,
            discipline: true,
          },
        }),
      );

      const coachId =
        booking.coachAvailability?.coachId ||
        booking.schedule?.coachId ||
        actor.userId;

      if (actor.role === UserRole.COACH && actor.userId !== coachId) {
        await memberAccess(tx, actor, booking.memberId);
      }

      let template: any;
      if (dto.templateCode) {
        template = requireRecord(
          await (tx as any).workoutTemplate.findUnique({
            where: { templateCode: dto.templateCode },
            include: { exercises: { orderBy: { orderIndex: 'asc' } } },
          }),
        );
      } else {
        const disciplineCode = booking.discipline?.code || 'BOXING';
        let sessionOrder = dto.sessionOrder;
        if (!sessionOrder) {
          // Tự động đếm số thứ tự buổi tập trong subscription này
          const count = await tx.booking.count({
            where: {
              subscriptionId: booking.subscriptionId,
              status: { in: ['CONFIRMED', 'ATTENDED'] },
              bookedAt: { lte: booking.bookedAt },
            },
          });
          sessionOrder = Math.max(count, 1);
        }

        if (sessionOrder > 12) {
          throw new BadRequestException(
            `Khóa tập tiêu chuẩn chỉ gồm 12 buổi template (buổi 1-12). Buổi tập số ${sessionOrder} là buổi tự do/cardio nhẹ do HLV tự thiết kế thủ công.`,
          );
        }

        template = requireRecord(
          await (tx as any).workoutTemplate.findFirst({
            where: {
              disciplineCode: { equals: disciplineCode, mode: 'insensitive' },
              sessionOrder,
            },
            include: { exercises: { orderBy: { orderIndex: 'asc' } } },
          }),
        );
      }

      const existing = await (tx as any).workoutPlan.findFirst({
        where: { bookingId: dto.bookingId },
      });

      if (existing) {
        await tx.workoutExercise.deleteMany({
          where: { workoutPlanId: existing.id },
        });
        const updated = await (tx as any).workoutPlan.update({
          where: { id: existing.id },
          data: {
            templateId: template.id,
            sessionOrder: template.sessionOrder,
            title: template.title,
            exercises: {
              create: template.exercises.map((e: any, orderIndex: number) => ({
                exerciseId: e.exerciseId,
                sets: e.sets,
                reps: e.reps,
                weightKg: e.weightKg,
                restSeconds: e.restSeconds,
                orderIndex,
              })),
            },
          },
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
        });
        await audit(
          tx,
          actor,
          'ASSIGN_WORKOUT_TEMPLATE',
          'workout_plans',
          updated.id,
        );
        return updated;
      }

      const created = await (tx as any).workoutPlan.create({
        data: {
          memberId: booking.memberId,
          coachId,
          bookingId: dto.bookingId,
          templateId: template.id,
          sessionOrder: template.sessionOrder,
          title: template.title,
          notes: template.description,
          exercises: {
            create: template.exercises.map((e: any, orderIndex: number) => ({
              exerciseId: e.exerciseId,
              sets: e.sets,
              reps: e.reps,
              weightKg: e.weightKg,
              restSeconds: e.restSeconds,
              orderIndex,
            })),
          },
        },
        include: {
          exercises: {
            include: { exercise: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      await audit(
        tx,
        actor,
        'ASSIGN_WORKOUT_TEMPLATE',
        'workout_plans',
        created.id,
      );
      return created;
    });
  }

  async getPlanByBooking(bookingId: string, actor: Actor) {
    const plan = await (this.prisma as any).workoutPlan.findFirst({
      where: { bookingId },
      include: {
        exercises: {
          include: { exercise: true },
          orderBy: { orderIndex: 'asc' },
        },
        template: true,
      },
    });

    if (plan && actor.role === UserRole.MEMBER) {
      requireOwner(actor, plan.memberId);
    }

    return plan;
  }
}
