import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-profile.dto';
import { Actor } from '../../common/types/actor';
import { audit, memberAccess, requireRecord } from '../../common/utils/domain';
import { EmailService } from '../auth/email.service';
const selection = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  gender: true,
  isActive: true,
  avatarUrl: true,
  checkinCode: true,
  createdAt: true,
} as const;
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly emailService: EmailService,
  ) {}
  async createUser(dto: CreateUserDto, actor: Actor) {
    const allowed: UserRole[] =
      actor.role === UserRole.ADMIN
        ? [UserRole.CENTER_MANAGER]
        : actor.role === UserRole.CENTER_MANAGER
          ? [UserRole.COACH, UserRole.RECEPTIONIST, UserRole.MEMBER]
          : actor.role === UserRole.RECEPTIONIST
            ? [UserRole.MEMBER]
            : [];
    if (!allowed.includes(dto.role))
      throw new ForbiddenException('ROLE_HIERARCHY_VIOLATION');

    const pEmail = dto.personalEmail?.trim().toLowerCase();
    if (pEmail) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: pEmail },
      });
      if (existingUser) {
        throw new BadRequestException('Gmail cá nhân này đã được đăng ký tài khoản trong hệ thống.');
      }
      const existingCoach = await this.prisma.coachProfile.findFirst({
        where: { bio: { contains: pEmail, mode: 'insensitive' } },
      });
      if (existingCoach) {
        throw new BadRequestException('Gmail cá nhân này đã từng được sử dụng để tạo tài khoản Huấn luyện viên.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.transactions.run(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          phone: dto.phone?.trim() || `09${Math.floor(10000000 + Math.random() * 90000000)}`,
          avatarUrl: dto.avatarUrl,
          role: dto.role,
          gender: dto.gender,
          passwordHash,
          createdById: actor.userId,
          ...(dto.role === UserRole.COACH
            ? {
                coachProfile: {
                  create: {
                    bio: pEmail ? `Email cá nhân: ${pEmail}` : null,
                    bankName: dto.bankName?.trim() || null,
                    bankAccountNumber: dto.bankAccountNumber?.trim() || null,
                    bankAccountName: dto.bankAccountName?.trim() || null,
                    ratingStars: dto.ratingStars
                      ? Math.max(1, Math.min(5, Number(dto.ratingStars)))
                      : (dto.ratePerSession
                          ? (dto.ratePerSession <= 10000
                              ? Math.min(5, Math.max(1, Math.round(dto.ratePerSession / 1000)))
                              : Math.min(5, Math.max(1, Math.round(dto.ratePerSession / 100000))))
                          : 1),
                    ratePerSession: dto.ratePerSession
                      ? Number(dto.ratePerSession)
                      : (dto.ratingStars ? dto.ratingStars * 1000 : 1000),
                    workingDays: dto.workingDays || [
                      'MONDAY',
                      'TUESDAY',
                      'WEDNESDAY',
                      'THURSDAY',
                      'FRIDAY',
                      'SATURDAY',
                    ],
                    workingHours: dto.workingHours || [
                      { shift: 'Sáng', from: '08:00', to: '12:00' },
                      { shift: 'Chiều', from: '14:00', to: '18:00' },
                    ],
                  },
                },
              }
            : {}),
          ...(dto.role === UserRole.MEMBER
            ? { memberProfile: { create: {} } }
            : {}),
        },
        select: selection,
      });
      if (dto.role === UserRole.COACH) {
        if (dto.specialtyIds && dto.specialtyIds.length > 0) {
          const profile = await tx.coachProfile.findUnique({
            where: { userId: user.id },
          });
          if (profile) {
            const specs = await tx.specialty.findMany({
              where: {
                OR: [
                  { id: { in: dto.specialtyIds } },
                  { disciplineId: { in: dto.specialtyIds } },
                ],
              },
            });
            if (specs.length > 0) {
              await tx.coachSpecialty.createMany({
                data: specs.map((spec) => ({
                  coachProfileId: profile.id,
                  specialtyId: spec.id,
                })),
                skipDuplicates: true,
              });
            }
          }
        }
        const finalRate = dto.ratePerSession
          ? Number(dto.ratePerSession)
          : (dto.ratingStars ? dto.ratingStars * 1000 : 1000);
        await tx.coachRate.create({
          data: {
            coachId: user.id,
            ratePerSession: finalRate,
            coach_name: user.fullName,
          },
        });
      }
      await audit(tx, actor, 'CREATE_USER', 'users', user.id, user);
      return {
        ...user,
        generatedPassword: dto.password,
        personalEmail: dto.personalEmail || null,
      };
    });

    const targetEmail = pEmail || dto.email?.trim().toLowerCase();
    let emailSent = false;
    let emailError: string | null = null;
    if (targetEmail) {
      try {
        const result =
          await this.emailService.sendStaffAccountCredentialsEmailWithStatus(
            targetEmail,
            {
              fullName: dto.fullName,
              systemEmail: dto.email.trim().toLowerCase(),
              password: dto.password,
              role: dto.role,
            },
          );
        emailSent = result.sent;
        emailError = result.error ?? null;
      } catch (err) {
        emailSent = false;
        emailError =
          err instanceof Error ? err.message : 'Lỗi không xác định khi gửi email';
        this.logger.error(`Error sending credentials email to ${targetEmail}:`, err);
      }
    }

    return {
      ...created,
      emailSent,
      emailError,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('USER_NOT_FOUND');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu mới phải có tối thiểu 6 ký tự');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    return { success: true, message: 'Đổi mật khẩu thành công' };
  }
  async findAll(role?: UserRole, q?: string, page?: number, limit?: number) {
    const p = page && page > 0 ? Number(page) : 1;
    const l = limit && limit > 0 ? Math.min(Number(limit), 100) : 50;
    const skip = (p - 1) * l;
    const where: Prisma.UserWhereInput = {
      role,
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          ...selection,
          coachProfile: {
            select: {
              ratingStars: true,
              ratePerSession: true,
              workingDays: true,
              workingHours: true,
              bankName: true,
              bankAccountNumber: true,
              bankAccountName: true,
              coachSpecialties: {
                include: {
                  specialty: true,
                },
              },
            },
          },
        },
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items, total, page: p, limit: l };
  }
  async findById(id: string, actor?: Actor) {
    return this.transactions.run(async (tx) => {
      if (actor) await memberAccess(tx, actor, id);
      return requireRecord(
        await tx.user.findUnique({
          where: { id },
          select: {
            ...selection,
            memberProfile: true,
            coachProfile: {
              include: {
                coachSpecialties: {
                  include: {
                    specialty: {
                      include: { discipline: true },
                    },
                  },
                },
              },
            },
          },
        }),
        'USER_NOT_FOUND',
      );
    });
  }
  async updateProfile(id: string, dto: UpdateProfileDto, actor: Actor) {
    if (
      actor.userId !== id &&
      ![UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST].includes(
        actor.role as never,
      )
    )
      throw new ForbiddenException('FORBIDDEN_RESOURCE');

    let targetRole: UserRole = actor.role as UserRole;
    if (actor.userId !== id) {
      const current = requireRecord(
        await this.prisma.user.findUnique({
          where: { id },
          select: { id: true, role: true },
        }),
      );
      if (current.role !== UserRole.MEMBER)
        throw new ForbiddenException('FORBIDDEN_RESOURCE');
      targetRole = current.role;
    }

    const {
      currentPassword,
      fitnessGoals,
      medicalHistory,
      heightCm,
      bio,
      yearsExperience,
      certificateUrls,
      bankName,
      bankAccountNumber,
      bankAccountName,
      workingDays,
      workingHours,
      ...userData
    } = dto;

    if (actor.userId === id) {
      const existingUser = requireRecord(
        await this.prisma.user.findUnique({
          where: { id },
          select: { id: true, passwordHash: true },
        }),
        'USER_NOT_FOUND',
      );
      if (!currentPassword) {
        throw new BadRequestException(
          'Vui lòng nhập mật khẩu hiện tại để xác nhận lưu thay đổi',
        );
      }
      const valid = await bcrypt.compare(currentPassword, existingUser.passwordHash);
      if (!valid) {
        throw new BadRequestException('Mật khẩu xác nhận không chính xác');
      }
    }

    // Validate max 8 hours per day for coach working hours (per day, not across whole week)
    if (workingHours && Array.isArray(workingHours)) {
      const dayMinutesMap: Record<string, number> = {};
      let unassignedMinutes = 0;

      for (const wh of workingHours) {
        const startStr = wh.start || wh.from || '08:00';
        const endStr = wh.end || wh.to || '12:00';
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        const duration = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
        if (duration > 0) {
          if (wh.day) {
            dayMinutesMap[wh.day] = (dayMinutesMap[wh.day] || 0) + duration;
          } else {
            unassignedMinutes += duration;
          }
        }
      }

      if (unassignedMinutes > 8 * 60) {
        throw new BadRequestException(
          'Khung giờ rảnh đăng ký không được vượt quá 8h/ngày theo quy định của trung tâm.',
        );
      }

      for (const [day, mins] of Object.entries(dayMinutesMap)) {
        if (mins > 8 * 60) {
          throw new BadRequestException(
            `Khung giờ rảnh của ${day} vượt quá mức tối đa 8h/ngày theo quy định của trung tâm.`,
          );
        }
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...userData,
        ...(targetRole === UserRole.MEMBER
          ? {
              memberProfile: {
                upsert: {
                  create: { fitnessGoals, medicalHistory, heightCm },
                  update: { fitnessGoals, medicalHistory, heightCm },
                },
              },
            }
          : {}),
        ...(targetRole === UserRole.COACH
          ? {
              coachProfile: {
                upsert: {
                  create: {
                    bio,
                    yearsExperience,
                    certificateUrls,
                    bankName,
                    bankAccountNumber,
                    bankAccountName,
                    workingDays,
                    workingHours,
                  },
                  update: {
                    bio,
                    yearsExperience,
                    certificateUrls,
                    bankName,
                    bankAccountNumber,
                    bankAccountName,
                    workingDays,
                    workingHours,
                  },
                },
              },
            }
          : {}),
      },
      select: {
        ...selection,
        ...(targetRole === UserRole.MEMBER ? { memberProfile: true } : {}),
        ...(targetRole === UserRole.COACH ? { coachProfile: true } : {}),
      },
    });
    void audit(this.prisma, actor, 'UPDATE_PROFILE', 'users', id).catch(() => {});
    return user;
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
    const {
      password,
      ratingStars,
      bankName,
      bankAccountNumber,
      bankAccountName,
      workingDays,
      workingHours,
      ...data
    } = dto;
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
        select: {
          ...selection,
          coachProfile: {
            select: {
              ratingStars: true,
              ratePerSession: true,
              workingDays: true,
              workingHours: true,
              bankName: true,
              bankAccountNumber: true,
              bankAccountName: true,
              coachSpecialties: {
                include: {
                  specialty: true,
                },
              },
            },
          },
        },
      });

      if (target.role === UserRole.COACH) {
        if (
          ratingStars !== undefined ||
          bankName !== undefined ||
          bankAccountNumber !== undefined ||
          bankAccountName !== undefined ||
          workingDays !== undefined ||
          workingHours !== undefined
        ) {
          const ratePerSession =
            ratingStars !== undefined
              ? new Prisma.Decimal(ratingStars * 1000)
              : undefined;
          await tx.coachProfile.upsert({
            where: { userId: id },
            create: {
              userId: id,
              ratingStars: ratingStars ?? 3,
              ratePerSession: ratePerSession ?? new Prisma.Decimal(3000),
              bankName,
              bankAccountNumber,
              bankAccountName,
              workingDays,
              workingHours,
            },
            update: {
              ...(ratingStars !== undefined
                ? { ratingStars, ratePerSession }
                : {}),
              ...(bankName !== undefined ? { bankName } : {}),
              ...(bankAccountNumber !== undefined ? { bankAccountNumber } : {}),
              ...(bankAccountName !== undefined ? { bankAccountName } : {}),
              ...(workingDays !== undefined ? { workingDays } : {}),
              ...(workingHours !== undefined ? { workingHours } : {}),
            },
          });
        }
      }
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
      const current = requireRecord(
        await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true },
        }),
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
        select: {
          ...selection,
          ...(current.role === UserRole.MEMBER ? { memberProfile: true } : {}),
          ...(current.role === UserRole.COACH
            ? {
                coachProfile: {
                  include: {
                    coachSpecialties: {
                      include: {
                        specialty: {
                          include: { discipline: true },
                        },
                      },
                    },
                  },
                },
              }
            : {}),
        },
      });

      await audit(tx, actor, 'UPLOAD_AVATAR', 'users', id, {
        avatarUrl: publicUrl,
      });
      return updatedUser;
    });
  }
}
