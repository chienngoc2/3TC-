import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-profile.dto';
import { Actor } from '../../common/types/actor';
import { audit, memberAccess, requireRecord } from '../../common/utils/domain';
const selection = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  createdAt: true,
} as const;
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  async createUser(dto: CreateUserDto, actor: Actor) {
    const allowed: UserRole[] =
      actor.role === UserRole.ADMIN
        ? [UserRole.CENTER_MANAGER]
        : actor.role === UserRole.CENTER_MANAGER
          ? [UserRole.COACH, UserRole.RECEPTIONIST, UserRole.MEMBER]
          : [];
    if (!allowed.includes(dto.role))
      throw new ForbiddenException('ROLE_HIERARCHY_VIOLATION');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.transactions.run(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          phone: dto.phone,
          avatarUrl: dto.avatarUrl,
          role: dto.role,
          passwordHash,
          createdById: actor.userId,
          ...(dto.role === UserRole.COACH
            ? { coachProfile: { create: {} } }
            : {}),
          ...(dto.role === UserRole.MEMBER
            ? { memberProfile: { create: {} } }
            : {}),
        },
        select: selection,
      });
      await audit(tx, actor, 'CREATE_USER', 'users', user.id, user);
      return user;
    });
  }
  findAll(role?: UserRole, q?: string) {
    return this.prisma.user.findMany({
      where: {
        role,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: selection,
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  async findById(id: string, actor?: Actor) {
    return this.transactions.run(async (tx) => {
      if (actor) await memberAccess(tx, actor, id);
      return requireRecord(
        await tx.user.findUnique({
          where: { id },
          select: { ...selection, memberProfile: true, coachProfile: true },
        }),
        'USER_NOT_FOUND',
      );
    });
  }
  async updateProfile(id: string, dto: UpdateProfileDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const current = requireRecord(
        await tx.user.findUnique({ where: { id } }),
      );
      if (
        actor.userId !== id &&
        ![UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST].includes(
          actor.role as never,
        )
      )
        throw new ForbiddenException('FORBIDDEN_RESOURCE');
      if (actor.userId !== id && current.role !== UserRole.MEMBER)
        throw new ForbiddenException('FORBIDDEN_RESOURCE');
      const {
        fitnessGoals,
        medicalHistory,
        heightCm,
        bio,
        yearsExperience,
        certificateUrls,
        ...userData
      } = dto;
      const user = await tx.user.update({
        where: { id },
        data: {
          ...userData,
          ...(current.role === UserRole.MEMBER
            ? {
                memberProfile: {
                  upsert: {
                    create: { fitnessGoals, medicalHistory, heightCm },
                    update: { fitnessGoals, medicalHistory, heightCm },
                  },
                },
              }
            : {}),
          ...(current.role === UserRole.COACH
            ? {
                coachProfile: {
                  upsert: {
                    create: { bio, yearsExperience, certificateUrls },
                    update: { bio, yearsExperience, certificateUrls },
                  },
                },
              }
            : {}),
        },
        select: { ...selection, memberProfile: true, coachProfile: true },
      });
      await audit(tx, actor, 'UPDATE_PROFILE', 'users', id);
      return user;
    });
  }
  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actor: Actor,
    expectedRole?: UserRole,
  ) {
    const target = requireRecord(
      await this.prisma.user.findUnique({ where: { id } }),
    );
    const allowed =
      actor.role === UserRole.ADMIN
        ? target.role === UserRole.CENTER_MANAGER
        : actor.role === UserRole.CENTER_MANAGER &&
          [UserRole.COACH, UserRole.RECEPTIONIST, UserRole.MEMBER].includes(
            target.role as never,
          );
    if (!allowed || (expectedRole && target.role !== expectedRole))
      throw new ForbiddenException('ROLE_HIERARCHY_VIOLATION');
    const { password, ...data } = dto;
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    const result = await this.transactions.run(async (tx) => {
      const shouldRevoke = password || data.isActive === false;
      const user = await tx.user.update({
        where: { id },
        data: {
          ...data,
          passwordHash,
          ...(shouldRevoke ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: selection,
      });
      if (shouldRevoke) {
        await tx.userSession.deleteMany({ where: { userId: id } });
      }
      await audit(
        tx,
        actor,
        data.isActive === false ? 'DISABLE_USER' : 'UPDATE_USER',
        'users',
        id,
        user,
      );
      return user;
    });
    return result;
  }

  async uploadAvatar(id: string, file: Express.Multer.File, actor: Actor) {
    if (
      actor.userId !== id &&
      ![UserRole.ADMIN, UserRole.CENTER_MANAGER].includes(actor.role as never)
    ) {
      throw new ForbiddenException('FORBIDDEN_RESOURCE');
    }

    if (!file) {
      throw new BadRequestException('FILE_REQUIRED');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('INVALID_FILE_TYPE');
    }

    if (file.size > 3 * 1024 * 1024) {
      throw new BadRequestException('FILE_TOO_LARGE');
    }

    return this.transactions.run(async (tx) => {
      requireRecord(
        await tx.user.findUnique({ where: { id } }),
        'USER_NOT_FOUND',
      );

      const ext = file.originalname.split('.').pop()?.toLowerCase() || 'webp';
      const storagePath = `${id}/avatar.${ext}`;
      const bucketId = 'avatars';

      await tx.$executeRaw`
        INSERT INTO storage.objects (
          id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata
        ) VALUES (
          gen_random_uuid(),
          ${bucketId},
          ${storagePath},
          ${id}::uuid,
          NOW(),
          NOW(),
          NOW(),
          jsonb_build_object(
            'size', ${file.size},
            'mimetype', ${file.mimetype}
          )
        )
        ON CONFLICT (bucket_id, name, version) DO UPDATE SET
          updated_at = NOW(),
          last_accessed_at = NOW(),
          metadata = jsonb_build_object(
            'size', ${file.size},
            'mimetype', ${file.mimetype}
          );
      `;

      const projectRef = 'osewnmtackjotxohfgbg';
      const publicUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/${bucketId}/${storagePath}?v=${Date.now()}`;

      const updatedUser = await tx.user.update({
        where: { id },
        data: { avatarUrl: publicUrl },
        select: { ...selection, memberProfile: true, coachProfile: true },
      });

      await audit(tx, actor, 'UPLOAD_AVATAR', 'users', id, {
        avatarUrl: publicUrl,
      });
      return updatedUser;
    });
  }
}
