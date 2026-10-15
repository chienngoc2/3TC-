import { Injectable } from '@nestjs/common';
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
import { WorkoutDto, UpdateWorkoutDto, KnowledgeDto } from './dto/workout.dto';
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
}
