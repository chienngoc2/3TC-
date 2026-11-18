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
  WorkoutPlanListQueryDto,
  ExerciseKnowledgeQueryDto,
} from './dto/workout.dto';
import { parsePagination } from '../../common/dto/pagination.dto';
import { UserRole } from '@prisma/client';
import { analyzeInbody } from '../inbody/inbody-calc.util';
@Injectable()
export class WorkoutPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  async list(actor: Actor, query?: WorkoutPlanListQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const where =
      actor.role === 'MEMBER'
        ? { memberId: actor.userId }
        : actor.role === 'COACH'
          ? {
              coachId: actor.userId,
              ...(query?.memberId ? { memberId: query.memberId } : {}),
            }
          : {
              ...(query?.memberId ? { memberId: query.memberId } : {}),
              ...(query?.coachId ? { coachId: query.coachId } : {}),
            };

    const [total, items] = await Promise.all([
      this.prisma.workoutPlan.count({ where }),
      this.prisma.workoutPlan.findMany({
        where,
        include: {
          exercises: {
            include: { exercise: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { items, total, page, limit };
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
  async knowledge(query?: ExerciseKnowledgeQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const where = {
      ...(query?.category ? { category: query.category } : {}),
      ...(query?.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { instructions: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.exerciseKnowledge.count({ where }),
      this.prisma.exerciseKnowledge.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
      }),
    ]);
    return { items, total, page, limit };
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

  async getRecommendations(memberId: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await memberAccess(tx, actor, memberId);

      const latestInbody = await tx.memberInbodyLog.findFirst({
        where: { userId: memberId },
        orderBy: { measuredAt: 'desc' },
      });

      const member = await tx.user.findUnique({
        where: { id: memberId },
        include: { memberProfile: true },
      });

      if (!latestInbody) {
        const defaultTemplate = await tx.workoutTemplate.findFirst({
          include: { exercises: { include: { exercise: true }, take: 6 } },
        });

        return {
          memberId,
          memberName: member?.fullName,
          hasInbodyData: false,
          bodyShape: 'UNKNOWN',
          bodyShapeDescription: 'Chưa có dữ liệu đo InBody. Gợi ý phác đồ rèn luyện nền tảng.',
          primaryGoal: member?.memberProfile?.fitnessGoals || 'GENERAL_FITNESS',
          primaryGoalTitle: 'Thể lực nền tảng tổng quát',
          hasSignificantImbalance: false,
          imbalances: [],
          suggestedTemplate: defaultTemplate ? {
            id: defaultTemplate.id,
            title: defaultTemplate.title,
            disciplineCode: defaultTemplate.disciplineCode,
            description: defaultTemplate.description,
            exerciseCount: defaultTemplate.exercises?.length || 0,
          } : null,
          recommendedExercises: defaultTemplate?.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exercise.title,
            category: e.exercise.category,
            sets: e.sets || 3,
            reps: e.reps || 12,
            unilateral: false,
            notes: 'Tập trung chuẩn hóa kỹ thuật cơ bản',
          })) || [],
          cardioPrescription: null,
          nutritionAdvice: null,
        };
      }

      const analysis = analyzeInbody(latestInbody);
      const bfm = latestInbody.bodyFatMassKg ? Number(latestInbody.bodyFatMassKg) : null;
      const bodyFatPct = latestInbody.bodyFatPct ? Number(latestInbody.bodyFatPct) : null;

      let primaryGoal = 'LEAN_HYPERTROPHY';
      let primaryGoalTitle = 'Tăng cơ nạc thuần (Hypertrophy)';
      if (analysis.bodyShape === 'TYPE_C' || (bodyFatPct && bodyFatPct > 24)) {
        primaryGoal = 'FAT_LOSS_RECOMP';
        primaryGoalTitle = 'Đốt mỡ & Tái cấu trúc cơ thể (Recomposition)';
      } else if (analysis.bodyShape === 'TYPE_D') {
        primaryGoal = 'ATHLETIC_STRENGTH';
        primaryGoalTitle = 'Phát triển sức mạnh & Thể lực đỉnh cao';
      }

      // Query candidate exercises
      const allKnowledge = await tx.exerciseKnowledge.findMany({ take: 50 });
      const recommendedExercises: any[] = [];

      // If significant imbalance, recommend unilateral exercises
      if (analysis.hasSignificantImbalance) {
        const armImb = analysis.imbalances.find((i) => i.zone === 'ARMS' && i.severity === 'SIGNIFICANT');
        const legImb = analysis.imbalances.find((i) => i.zone === 'LEGS' && i.severity === 'SIGNIFICANT');

        if (armImb) {
          const armExs = allKnowledge.filter(
            (e) =>
              /dumbbell|single|one-arm|cable/i.test(e.title) &&
              /arm|bicep|tricep|chest|shoulder|back/i.test(e.category + ' ' + e.title),
          );
          (armExs.slice(0, 2)).forEach((e) => {
            recommendedExercises.push({
              exerciseId: e.id,
              exerciseName: e.title,
              category: e.category,
              sets: 4,
              reps: 10,
              unilateral: true,
              targetZone: 'ARMS',
              targetSide: `${armImb.weakerSide}_PRIORITY`,
              notes: `Ưu tiên tập tay ${armImb.weakerSide === 'LEFT' ? 'Trái' : 'Phải'} trước (bên yếu hơn). Lấy số rep bên yếu làm chuẩn.`,
            });
          });
        }

        if (legImb) {
          const legExs = allKnowledge.filter(
            (e) =>
              /lunge|split|single|step/i.test(e.title) ||
              (/leg/i.test(e.category) && /dumbbell|squat/i.test(e.title)),
          );
          (legExs.slice(0, 2)).forEach((e) => {
            recommendedExercises.push({
              exerciseId: e.id,
              exerciseName: e.title,
              category: e.category,
              sets: 4,
              reps: 12,
              unilateral: true,
              targetZone: 'LEGS',
              targetSide: `${legImb.weakerSide}_PRIORITY`,
              notes: `Tập chân ${legImb.weakerSide === 'LEFT' ? 'Trái' : 'Phải'} trước để cân bằng sức mạnh khung xương chậu.`,
            });
          });
        }
      }

      // Fill remaining compound exercises if needed
      const compoundExs = allKnowledge.filter(
        (e) => !recommendedExercises.some((r) => r.exerciseId === e.id),
      );
      compoundExs.slice(0, Math.max(0, 5 - recommendedExercises.length)).forEach((e) => {
        recommendedExercises.push({
          exerciseId: e.id,
          exerciseName: e.title,
          category: e.category,
          sets: primaryGoal === 'ATHLETIC_STRENGTH' ? 5 : 3,
          reps: primaryGoal === 'ATHLETIC_STRENGTH' ? 5 : 12,
          unilateral: false,
          notes: 'Bài tập đa khớp tăng cường khối lượng cơ nền tảng',
        });
      });

      // Find matching template
      const suggestedTemplate = await tx.workoutTemplate.findFirst({
        where: {
          disciplineCode: {
            contains: primaryGoal === 'FAT_LOSS_RECOMP' ? 'GYM' : 'FITNESS',
            mode: 'insensitive',
          },
        },
        include: { exercises: { include: { exercise: true } } },
      }) || await tx.workoutTemplate.findFirst({
        include: { exercises: { include: { exercise: true } } },
      });

      const bmr = latestInbody.bmrKcal || 1500;
      const tdee = Math.round(bmr * 1.35);

      return {
        memberId,
        memberName: member?.fullName,
        hasInbodyData: true,
        lastMeasuredAt: latestInbody.measuredAt,
        bodyShape: analysis.bodyShape,
        bodyShapeDescription: analysis.bodyShapeDescription,
        bmi: latestInbody.bmi ? Number(latestInbody.bmi) : null,
        weightKg: Number(latestInbody.weightKg),
        bodyFatPct: bodyFatPct,
        bodyFatMassKg: bfm,
        skeletalMuscleMassKg: latestInbody.skeletalMuscleMassKg ? Number(latestInbody.skeletalMuscleMassKg) : null,
        visceralFatLevel: latestInbody.visceralFatLevel,
        bmrKcal: bmr,
        primaryGoal,
        primaryGoalTitle,
        hasSignificantImbalance: analysis.hasSignificantImbalance,
        imbalances: analysis.imbalances,
        suggestedTemplate: suggestedTemplate ? {
          id: suggestedTemplate.id,
          title: suggestedTemplate.title,
          disciplineCode: suggestedTemplate.disciplineCode,
          description: suggestedTemplate.description,
          exerciseCount: suggestedTemplate.exercises?.length || 0,
        } : null,
        recommendedExercises,
        cardioPrescription: latestInbody.visceralFatLevel && latestInbody.visceralFatLevel >= 10 ? {
          targetZone: 'ZONE_2',
          durationMinutes: 25,
          frequencyPerWeek: 3,
          reason: 'Mỡ nội tạng cấp độ cao (>= 10). Cần 25 phút Cardio nhịp tim Zone 2 cuối mỗi buổi để kích hoạt tiêu hao mỡ nội tạng an toàn.',
        } : null,
        nutritionAdvice: {
          estimatedTdeeKcal: tdee,
          targetDailyCalories: primaryGoal === 'FAT_LOSS_RECOMP' ? tdee - 400 : primaryGoal === 'ATHLETIC_STRENGTH' ? tdee + 300 : tdee,
          proteinTargetGrams: Math.round(Number(latestInbody.weightKg) * 1.8),
          guideline: primaryGoal === 'FAT_LOSS_RECOMP'
            ? 'Thâm hụt 400 kcal/ngày, nạp đủ 1.8g protein/kg để duy trì cơ bắp.'
            : 'Ăn thặng dư nhẹ 300 kcal/ngày với thực phẩm nguyên phần giàu dinh dưỡng.',
        },
      };
    });
  }
}
