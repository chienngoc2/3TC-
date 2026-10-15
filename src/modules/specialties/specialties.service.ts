import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireCondition,
  requireRecord,
  requireRole,
} from '../../common/utils/domain';
import {
  SpecialtyDto,
  UpdateSpecialtyDto,
} from '../operations/dto/operations.dto';
@Injectable()
export class SpecialtiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list(disciplineId?: string) {
    return this.prisma.specialty.findMany({
      where: { disciplineId },
      include: { discipline: true },
      orderBy: { name: 'asc' },
    });
  }
  create(dto: SpecialtyDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const value = await tx.specialty.create({ data: dto });
      await audit(tx, actor, 'CREATE_SPECIALTY', 'specialties', value.id);
      return value;
    });
  }
  update(id: string, dto: UpdateSpecialtyDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const old = requireRecord(
        await tx.specialty.findUnique({ where: { id } }),
      );
      requireCondition(
        !dto.disciplineId || dto.disciplineId === old.disciplineId,
        'SPECIALTY_DISCIPLINE_IMMUTABLE',
      );
      const value = await tx.specialty.update({ where: { id }, data: dto });
      await audit(tx, actor, 'UPDATE_SPECIALTY', 'specialties', id);
      return value;
    });
  }
  delete(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      requireRecord(await tx.specialty.findUnique({ where: { id } }));
      await tx.specialty.delete({ where: { id } });
      await audit(tx, actor, 'DELETE_SPECIALTY', 'specialties', id);
      return { id };
    });
  }
  assign(coachId: string, specialtyIds: string[], actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, coachId, UserRole.COACH);
      const profile = requireRecord(
        await tx.coachProfile.findUnique({ where: { userId: coachId } }),
      );
      await tx.coachSpecialty.deleteMany({
        where: { coachProfileId: profile.id },
      });
      await tx.coachSpecialty.createMany({
        data: specialtyIds.map((specialtyId) => ({
          coachProfileId: profile.id,
          specialtyId,
        })),
      });
      await audit(
        tx,
        actor,
        'ASSIGN_SPECIALTIES',
        'coach_profiles',
        profile.id,
        { specialtyIds },
      );
      return tx.coachSpecialty.findMany({
        where: { coachProfileId: profile.id },
        include: { specialty: true },
      });
    });
  }
}
