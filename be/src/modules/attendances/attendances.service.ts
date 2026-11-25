import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { DomainEvents } from '../../common/events/domain-events';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireOwner,
  requireRole,
  memberAccess,
  localDate,
  addDays,
} from '../../common/utils/domain';
import {
  GateEntryDto,
  ClassAttendanceDto,
  UpdateAttendanceDto,
  AttendanceHistoryQueryDto,
  QrCheckinDto,
  ManualPinCheckinDto,
} from './dto/attendance.dto';
import { parsePagination } from '../../common/dto/pagination.dto';
import { getVietnamDateRange, getVietnamDayBounds } from '../../common/utils/timezone';
import { sortSubscriptionsByPriority } from './subscription-priority.util';
@Injectable()
export class AttendancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly events: DomainEvents,
  ) {}
  async gate(dto: GateEntryDto, actor: Actor) {
    const result = await this.transactions.run(async (tx) => {
      await requireRole(tx, dto.memberId, 'MEMBER');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gate:${dto.memberId}`}))`;
      const today = localDate(),
        dayStart = new Date(today.getTime() - 7 * 3600000),
        dayEnd = addDays(dayStart, 1);
      const validSubs = await tx.userSubscription.findMany({
        where: {
          userId: dto.memberId,
          status: 'ACTIVE',
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: { discipline: true },
        orderBy: { endDate: 'asc' },
      });
      const unlimited = validSubs.find(
        (sub) =>
          sub.hasUnlimitedGymAccess &&
          sub.discipline?.code.toUpperCase() === 'GYM',
      );
      const quotaAccess = validSubs.some(
        (sub) =>
          (sub.remainingGroupSessions ?? 0) > 0 ||
          (sub.remainingPtSessions ?? 0) > 0,
      );
      const gymDropin = validSubs.find(
        (sub) =>
          sub.discipline?.code.toUpperCase() === 'GYM' &&
          sub.packageTier === 'DROP_IN' &&
          (sub.remainingSessions ?? 0) > 0,
      );
      const dailyBooking = await tx.booking.findFirst({
        where: {
          memberId: dto.memberId,
          status: { in: ['CONFIRMED', 'ATTENDED'] },
          subscription: {
            status: 'ACTIVE',
            startDate: { lte: today },
            endDate: { gte: today },
          },
          OR: [
            {
              schedule: {
                status: { in: ['OPEN', 'FULL', 'COMPLETED'] },
                startTime: { gte: dayStart, lt: dayEnd },
              },
            },
            {
              coachAvailability: {
                isEmergencyCancelled: false,
                startTime: { gte: dayStart, lt: dayEnd },
              },
            },
          ],
        },
      });
      // An unreturned locker represents the same visit, so a repeated scan does not issue amenities twice.
      const current = await tx.lockerAssignment.findFirst({
        where: { userId: dto.memberId, returnedAt: null },
        include: { locker: true },
      });
      const recent = current
        ? await tx.attendance.findFirst({
            where: {
              memberId: dto.memberId,
              checkinType: 'GATE_ENTRY',
              checkInTime: { gte: current.assignedAt },
            },
            orderBy: { checkInTime: 'desc' },
          })
        : null;
      if (current && recent) {
        requireCondition(
          localDate(current.assignedAt).getTime() === today.getTime(),
          'RETURN_OVERNIGHT_LOCKER_FIRST',
        );
        const visitDropin = validSubs.some(
          (sub) =>
            sub.discipline?.code.toUpperCase() === 'GYM' &&
            sub.packageTier === 'DROP_IN',
        );
        requireCondition(
          unlimited || quotaAccess || dailyBooking || visitDropin,
          'GATE_ACCESS_DENIED',
        );
        return {
          attendance: recent,
          lockerAssignment: current,
          repeated: true,
        };
      }
      requireCondition(
        unlimited || quotaAccess || gymDropin || dailyBooking,
        'GATE_ACCESS_DENIED',
      );
      if (!unlimited && !quotaAccess && !dailyBooking && gymDropin) {
        const claimed = await tx.userSubscription.updateMany({
          where: { id: gymDropin.id, remainingSessions: { gt: 0 } },
          data: { remainingSessions: { decrement: 1 } },
        });
        requireCondition(claimed.count === 1, 'GATE_ACCESS_DENIED');
      }
      let lockerAssignment = current;
      if (!lockerAssignment && dto.lockerZone) {
        const available = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT l.id FROM lockers l 
          WHERE l.status = 'AVAILABLE' 
            AND l.is_active = true 
            AND l.zone = ${dto.lockerZone}
            AND NOT EXISTS (
              SELECT 1 FROM locker_assignments la 
              WHERE la.locker_id = l.id AND la.returned_at IS NULL
            )
          ORDER BY l.locker_number FOR UPDATE SKIP LOCKED LIMIT 1`;
        requireCondition(available.length, 'NO_AVAILABLE_LOCKER');
        const lockerId = available[0].id;
        await tx.locker.update({
          where: { id: lockerId },
          data: { status: 'OCCUPIED' },
        });
        lockerAssignment = await tx.lockerAssignment.create({
          data: { lockerId, userId: dto.memberId, assignedById: actor.userId },
          include: { locker: true },
        });
      }
      const attendance = await tx.attendance.create({
        data: {
          memberId: dto.memberId,
          verifiedById: actor.userId,
          checkinType: 'GATE_ENTRY',
          towelIssued: dto.towelIssued ?? false,
          notes: dto.notes,
        },
      });
      await audit(tx, actor, 'GATE_CHECK_IN', 'attendances', attendance.id);
      return { attendance, lockerAssignment, repeated: false };
    });
    if (!result.repeated) {
      this.events.publish({
        name: 'gate.checked-in',
        data: {
          attendanceId: result.attendance.id,
          memberId: dto.memberId,
          lockerNumber: result.lockerAssignment?.locker.lockerNumber,
        },
        userIds: [dto.memberId],
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });
      if (result.lockerAssignment) {
        this.events.publish({
          name: 'locker.changed',
          data: {
            lockerId: result.lockerAssignment.lockerId,
            lockerNumber: result.lockerAssignment.locker.lockerNumber,
            status: 'OCCUPIED',
            assignmentId: result.lockerAssignment.id,
            memberId: dto.memberId,
          },
          userIds: [dto.memberId],
          roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
        });
      }
    }
    return result;
  }
  async session(dto: ClassAttendanceDto, actor: Actor, allowUpdate = true) {
    const result = await this.transactions.run(async (tx) => {
      const booking = requireRecord(
        await tx.booking.findUnique({
          where: { id: dto.bookingId },
          include: { schedule: true, coachAvailability: true },
        }),
      );
      const session = requireRecord(
        booking.schedule ?? booking.coachAvailability,
      );
      requireOwner(actor, session.coachId);
      requireCondition(
        booking.status === 'CONFIRMED' || booking.status === 'ATTENDED',
        'BOOKING_NOT_ATTENDABLE',
      );
      requireCondition(session.startTime <= new Date(), 'SESSION_NOT_STARTED');
      const existing = await tx.attendance.findUnique({
        where: { bookingId: booking.id },
      });
      if (existing && !allowUpdate)
        throw new ConflictException('ALREADY_CHECKED_IN');
      requireCondition(
        Date.now() - (existing?.checkInTime ?? session.endTime).getTime() <=
          86400000,
        'ATTENDANCE_EDIT_WINDOW_CLOSED',
      );
      const attendance = await tx.attendance.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          memberId: booking.memberId,
          verifiedById: actor.userId,
          status: dto.status,
          notes: dto.notes,
        },
        update: {
          status: dto.status,
          notes: dto.notes,
          verifiedById: actor.userId,
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'ATTENDED' },
      });
      await audit(
        tx,
        actor,
        'MARK_SESSION_ATTENDANCE',
        'attendances',
        attendance.id,
        { status: dto.status },
      );
      return { attendance, booking };
    });
    this.events.publish({
      name: 'attendance.updated',
      data: result.attendance,
      userIds: [result.booking.memberId, actor.userId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
    });
    return result.attendance;
  }
  history(memberId: string, actor: Actor, query?: AttendanceHistoryQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const { startUtc, endUtc } = getVietnamDateRange(query?.from, query?.to);
    return this.transactions.run(async (tx) => {
      await memberAccess(tx, actor, memberId);
      const where = {
        memberId,
        ...(startUtc || endUtc
          ? {
              checkInTime: {
                ...(startUtc ? { gte: startUtc } : {}),
                ...(endUtc ? { lte: endUtc } : {}),
              },
            }
          : {}),
      };
      const [total, items] = await Promise.all([
        tx.attendance.count({ where }),
        tx.attendance.findMany({
          where,
          orderBy: { checkInTime: 'desc' },
          skip,
          take: limit,
        }),
      ]);
      return { items, total, page, limit };
    });
  }
  async correct(id: string, dto: UpdateAttendanceDto, actor: Actor) {
    const existing = requireRecord(
      await this.prisma.attendance.findUnique({ where: { id } }),
    );
    requireCondition(existing.bookingId, 'CLASS_ATTENDANCE_REQUIRED');
    return this.session({ ...dto, bookingId: existing.bookingId }, actor);
  }

  /**
   * Tạo mã QR phiên quầy Lễ tân (TTL: 180 giây / 3 phút, làm mới liên tục).
   */
  generateSessionQr(actor: Actor) {
    const secret = process.env.JWT_ACCESS_SECRET || 'front_desk_qr_secret_key_32c';
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(6).toString('hex');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`FRONT_DESK_CHECKIN:${timestamp}:${nonce}`)
      .digest('hex')
      .slice(0, 32);

    const token = `FDCK_${timestamp}_${nonce}_${signature}`;
    return {
      qrToken: token,
      expiresInSeconds: 180,
      expiresAt: new Date(timestamp + 180000).toISOString(),
      generatedAt: new Date(timestamp).toISOString(),
    };
  }

  /**
   * Xác thực tính hợp lệ của mã QR phiên (phải do quầy cấp và còn trong thời hạn 3 phút + dung sai 20s).
   */
  private verifyQrToken(token: string) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Mã QR không hợp lệ.');
    }
    const parts = token.split('_');
    if (parts.length !== 4 || parts[0] !== 'FDCK') {
      throw new BadRequestException('Định dạng mã QR không đúng hoặc không thuộc quầy lễ tân.');
    }

    const [, timeStr, nonce, signature] = parts;
    const timestamp = Number(timeStr);
    if (isNaN(timestamp)) {
      throw new BadRequestException('Mã QR không hợp lệ.');
    }

    // Cho phép thời hạn 3 phút + 20 giây dung sai mạng và lệch đồng hồ
    const ageMs = Date.now() - timestamp;
    if (ageMs > 200 * 1000) {
      throw new BadRequestException('Mã QR đã hết hạn (quá 3 phút). Vui lòng quét mã mới trên màn hình quầy.');
    }

    const secret = process.env.JWT_ACCESS_SECRET || 'front_desk_qr_secret_key_32c';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`FRONT_DESK_CHECKIN:${timestamp}:${nonce}`)
      .digest('hex')
      .slice(0, 32);

    if (signature !== expectedSig) {
      throw new BadRequestException('Chữ ký mã QR không hợp lệ hoặc đã bị chỉnh sửa.');
    }
  }

  /**
   * Học viên / HLV quét mã QR qua ứng dụng Mobile.
   * - Nếu là MEMBER: Chỉ cần có gói hợp lệ (ACTIVE & còn hạn) là cho qua.
   * - Nếu là COACH: Ghi nhận check-in HLV kèm môn phụ trách.
   * - Bắn SSE realtime về màn hình quầy Lễ tân hiển thị ngay lập tức.
   */
  async qrCheckin(dto: QrCheckinDto, actor: Actor) {
    this.verifyQrToken(dto.qrToken);
    const today = localDate();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (actor.role === 'MEMBER') {
      const [user, activeSubs, recentCheckin] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: actor.userId },
          select: { id: true, fullName: true, phone: true, avatarUrl: true },
        }),
        this.prisma.userSubscription.findMany({
          where: {
            userId: actor.userId,
            status: 'ACTIVE',
            startDate: { lte: today },
            endDate: { gte: today },
          },
          select: {
            id: true,
            packageTier: true,
            startDate: true,
            endDate: true,
            remainingSessions: true,
            remainingPtSessions: true,
            remainingGroupSessions: true,
            plan: { select: { name: true } },
            discipline: { select: { name: true } },
          },
          orderBy: { endDate: 'asc' },
        }),
        this.prisma.attendance.findFirst({
          where: {
            memberId: actor.userId,
            checkinType: 'GATE_ENTRY',
            checkInTime: { gte: fiveMinutesAgo },
          },
          select: { id: true, checkInTime: true },
          orderBy: { checkInTime: 'desc' },
        }),
      ]);

      if (!user) {
        throw new BadRequestException('Không tìm thấy thông tin tài khoản học viên.');
      }

      let chosenSub = activeSubs.length > 0 ? sortSubscriptionsByPriority(activeSubs)[0] : null;

      if (!chosenSub) {
        // Check if member has an active PT subscription with remaining quota and a session today
        const ptSubWithQuota = await this.prisma.userSubscription.findFirst({
          where: {
            userId: actor.userId,
            status: 'ACTIVE',
            remainingPtSessions: { gt: 0 },
          },
          select: {
            id: true,
            packageTier: true,
            startDate: true,
            endDate: true,
            remainingSessions: true,
            remainingPtSessions: true,
            remainingGroupSessions: true,
            plan: { select: { name: true } },
            discipline: { select: { name: true } },
          },
          orderBy: { endDate: 'desc' },
        });

        if (ptSubWithQuota) {
          const { startUtc, endUtc } = getVietnamDayBounds();
          const todayBooking = await this.prisma.booking.findFirst({
            where: {
              memberId: actor.userId,
              status: { in: ['CONFIRMED', 'PENDING'] },
              OR: [
                { coachAvailability: { startTime: { gte: startUtc, lte: endUtc } } },
                { schedule: { startTime: { gte: startUtc, lte: endUtc } } },
              ],
            },
          });
          if (todayBooking) {
            chosenSub = ptSubWithQuota;
          }
        }
      }

      if (!chosenSub) {
        const expiredSub = await this.prisma.userSubscription.findFirst({
          where: { userId: actor.userId },
          select: { endDate: true, plan: { select: { name: true } } },
          orderBy: { endDate: 'desc' },
        });
        if (expiredSub) {
          const expStr = new Intl.DateTimeFormat('vi-VN').format(expiredSub.endDate);
          throw new BadRequestException(
            `Gói tập (${expiredSub.plan?.name || 'Gói'}) của bạn đã hết hạn vào ngày ${expStr}. Vui lòng liên hệ quầy để gia hạn.`,
          );
        }
        throw new BadRequestException('Bạn chưa đăng ký gói tập nào hoặc gói tập chưa có hiệu lực.');
      }

      if (recentCheckin) {
        return {
          success: true,
          isRepeated: true,
          type: 'MEMBER',
          message: 'Bạn vừa check-in gần đây. Chúc bạn có buổi tập vui vẻ!',
          user: { fullName: user.fullName, phone: user.phone, avatarUrl: user.avatarUrl },
          plan: {
            name: chosenSub.plan?.name || chosenSub.discipline?.name || 'Gói tập hội viên',
            packageTier: chosenSub.packageTier,
            startDate: chosenSub.startDate,
            endDate: chosenSub.endDate,
            remainingSessions: chosenSub.remainingSessions,
            remainingPtSessions: chosenSub.remainingPtSessions,
            remainingGroupSessions: chosenSub.remainingGroupSessions,
          },
          checkinTime: recentCheckin.checkInTime,
        };
      }

      // Trừ lượt nếu là gói DROP_IN
      let attendance;
      if (chosenSub.packageTier === 'DROP_IN' && (chosenSub.remainingSessions ?? 0) > 0) {
        const [, att] = await this.prisma.$transaction([
          this.prisma.userSubscription.update({
            where: { id: chosenSub.id },
            data: { remainingSessions: { decrement: 1 } },
          }),
          this.prisma.attendance.create({
            data: {
              memberId: actor.userId,
              checkinType: 'GATE_ENTRY',
              notes: 'QR Check-in Mobile',
              verifiedById: actor.userId,
            },
          }),
        ]);
        attendance = att;
      } else {
        attendance = await this.prisma.attendance.create({
          data: {
            memberId: actor.userId,
            checkinType: 'GATE_ENTRY',
            notes: 'QR Check-in Mobile',
            verifiedById: actor.userId,
          },
        });
      }

      const checkinPayload = {
        type: 'MEMBER' as const,
        attendanceId: attendance.id,
        userId: actor.userId,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        planName: chosenSub.plan?.name || chosenSub.discipline?.name || 'Gói tập',
        packageTier: chosenSub.packageTier,
        startDate: chosenSub.startDate,
        endDate: chosenSub.endDate,
        remainingSessions: chosenSub.remainingSessions,
        remainingPtSessions: chosenSub.remainingPtSessions,
        remainingGroupSessions: chosenSub.remainingGroupSessions,
        checkinTime: attendance.checkInTime,
      };

      this.events.publish({
        name: 'frontdesk.qr-checkin',
        data: checkinPayload,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });

      return {
        success: true,
        isRepeated: false,
        type: 'MEMBER',
        message: 'Điểm danh vào cổng thành công!',
        user: { fullName: user.fullName, phone: user.phone, avatarUrl: user.avatarUrl },
        plan: {
          name: chosenSub.plan?.name || chosenSub.discipline?.name || 'Gói tập',
          packageTier: chosenSub.packageTier,
          startDate: chosenSub.startDate,
          endDate: chosenSub.endDate,
          remainingSessions: chosenSub.remainingSessions,
          remainingPtSessions: chosenSub.remainingPtSessions,
          remainingGroupSessions: chosenSub.remainingGroupSessions,
        },
        checkinTime: attendance.checkInTime,
      };
    }

    if (actor.role === 'COACH') {
      const [coachUser, recentCoachCheckin] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: actor.userId },
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true,
            coachProfile: {
              select: {
                ratingStars: true,
                coachSpecialties: {
                  select: {
                    specialty: {
                      select: {
                        name: true,
                        discipline: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.attendance.findFirst({
          where: {
            memberId: actor.userId,
            checkinType: 'GATE_ENTRY',
            checkInTime: { gte: fiveMinutesAgo },
          },
          select: { id: true, checkInTime: true },
          orderBy: { checkInTime: 'desc' },
        }),
      ]);

      if (!coachUser || !coachUser.coachProfile) {
        throw new BadRequestException('Không tìm thấy thông tin Huấn luyện viên.');
      }

      const disciplinesList = Array.from(
        new Set(
          coachUser.coachProfile.coachSpecialties
            .map((cs) => cs.specialty?.discipline?.name || cs.specialty?.name)
            .filter(Boolean),
        ),
      );
      const disciplinesDisplay = disciplinesList.length > 0 ? disciplinesList : ['Thể hình & Gym'];

      if (recentCoachCheckin) {
        return {
          success: true,
          isRepeated: true,
          type: 'COACH',
          message: 'Huấn luyện viên đã điểm danh gần đây!',
          user: {
            fullName: coachUser.fullName,
            phone: coachUser.phone,
            avatarUrl: coachUser.avatarUrl,
            disciplines: disciplinesDisplay,
            ratingStars: coachUser.coachProfile.ratingStars || 3,
          },
          checkinTime: recentCoachCheckin.checkInTime,
        };
      }

      const attendance = await this.prisma.attendance.create({
        data: {
          memberId: actor.userId,
          checkinType: 'GATE_ENTRY',
          notes: `HLV QR Check-in (${disciplinesDisplay.join(', ')})`,
          verifiedById: actor.userId,
        },
      });

      const checkinPayload = {
        type: 'COACH' as const,
        attendanceId: attendance.id,
        userId: actor.userId,
        fullName: coachUser.fullName,
        phone: coachUser.phone,
        avatarUrl: coachUser.avatarUrl,
        disciplines: disciplinesDisplay,
        ratingStars: coachUser.coachProfile.ratingStars || 3,
        checkinTime: attendance.checkInTime,
      };

      this.events.publish({
        name: 'frontdesk.qr-checkin',
        data: checkinPayload,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });

      return {
        success: true,
        isRepeated: false,
        type: 'COACH',
        message: 'Huấn luyện viên điểm danh vào ca thành công!',
        user: {
          fullName: coachUser.fullName,
          phone: coachUser.phone,
          avatarUrl: coachUser.avatarUrl,
          disciplines: disciplinesDisplay,
          ratingStars: coachUser.coachProfile.ratingStars || 3,
        },
        checkinTime: attendance.checkInTime,
      };
    }

    throw new BadRequestException('Chỉ Hội viên và Huấn luyện viên mới có thể quét mã điểm danh.');
  }

  /**
   * Check-in thủ công tại quầy Lễ tân khi Member / Coach không mang điện thoại.
   * Yêu cầu nhập SĐT và mã PIN bảo mật (4-6 số) của người tập.
   */
  async manualPinCheckin(dto: ManualPinCheckinDto, actor: Actor) {
    const rawPhone = dto.phone?.trim();
    const rawPin = dto.checkinCode?.trim();
    if (!rawPhone || !rawPin) {
      throw new BadRequestException('Vui lòng cung cấp đầy đủ số điện thoại và mã PIN check-in.');
    }

    // 1. Point lookup on unique phone index - fast & no transaction overhead!
    const user = (await this.prisma.user.findUnique({
      where: { phone: rawPhone },
      select: {
        id: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        checkinCode: true,
        isActive: true,
      },
    })) as any;

    if (!user || !user.isActive) {
      throw new BadRequestException('Không tìm thấy hội viên hoặc HLV với số điện thoại này.');
    }

    const userPin = user?.checkinCode;
    if (!userPin || userPin !== rawPin) {
      throw new BadRequestException('Mã PIN check-in bảo mật không chính xác. Vui lòng kiểm tra lại trong hồ sơ cá nhân.');
    }

    const today = localDate();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (user.role === 'MEMBER') {
      // 2. Fetch active subs and recent checkin concurrently
      const [activeSubs, recentCheckin] = await Promise.all([
        this.prisma.userSubscription.findMany({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            startDate: { lte: today },
            endDate: { gte: today },
          },
          select: {
            id: true,
            packageTier: true,
            startDate: true,
            endDate: true,
            remainingSessions: true,
            remainingPtSessions: true,
            remainingGroupSessions: true,
            plan: { select: { name: true } },
            discipline: { select: { name: true } },
          },
          orderBy: { endDate: 'asc' },
        }),
        this.prisma.attendance.findFirst({
          where: {
            memberId: user.id,
            checkinType: 'GATE_ENTRY',
            checkInTime: { gte: fiveMinutesAgo },
          },
          select: { id: true, checkInTime: true },
          orderBy: { checkInTime: 'desc' },
        }),
      ]);

      let chosenSub = activeSubs.length > 0 ? sortSubscriptionsByPriority(activeSubs)[0] : null;

      if (!chosenSub) {
        // Check if member has an active PT subscription with remaining quota and a session today
        const ptSubWithQuota = await this.prisma.userSubscription.findFirst({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            remainingPtSessions: { gt: 0 },
          },
          select: {
            id: true,
            packageTier: true,
            startDate: true,
            endDate: true,
            remainingSessions: true,
            remainingPtSessions: true,
            remainingGroupSessions: true,
            plan: { select: { name: true } },
            discipline: { select: { name: true } },
          },
          orderBy: { endDate: 'desc' },
        });

        if (ptSubWithQuota) {
          const { startUtc, endUtc } = getVietnamDayBounds();
          const todayBooking = await this.prisma.booking.findFirst({
            where: {
              memberId: user.id,
              status: { in: ['CONFIRMED', 'PENDING'] },
              OR: [
                { coachAvailability: { startTime: { gte: startUtc, lte: endUtc } } },
                { schedule: { startTime: { gte: startUtc, lte: endUtc } } },
              ],
            },
          });
          if (todayBooking) {
            chosenSub = ptSubWithQuota;
          }
        }
      }

      if (!chosenSub) {
        const expiredSub = await this.prisma.userSubscription.findFirst({
          where: { userId: user.id },
          select: { endDate: true, plan: { select: { name: true } } },
          orderBy: { endDate: 'desc' },
        });
        if (expiredSub) {
          const expStr = new Intl.DateTimeFormat('vi-VN').format(expiredSub.endDate);
          throw new BadRequestException(
            `Gói tập (${expiredSub.plan?.name || 'Gói'}) của hội viên đã hết hạn vào ngày ${expStr}. Vui lòng liên hệ quầy để gia hạn.`,
          );
        }
        throw new BadRequestException('Hội viên chưa đăng ký gói tập nào hoặc gói tập chưa có hiệu lực.');
      }

      if (recentCheckin) {
        return {
          success: true,
          isRepeated: true,
          type: 'MEMBER',
          message: 'Hội viên vừa check-in gần đây. Chúc bạn có buổi tập vui vẻ!',
          user: { fullName: user.fullName, phone: user.phone, avatarUrl: user.avatarUrl },
          plan: {
            name: chosenSub.plan?.name || chosenSub.discipline?.name || 'Gói tập hội viên',
            packageTier: chosenSub.packageTier,
            startDate: chosenSub.startDate,
            endDate: chosenSub.endDate,
            remainingSessions: chosenSub.remainingSessions,
            remainingPtSessions: chosenSub.remainingPtSessions,
            remainingGroupSessions: chosenSub.remainingGroupSessions,
          },
          checkinTime: recentCheckin.checkInTime,
        };
      }

      // Trừ lượt nếu là gói DROP_IN
      let attendance;
      if (chosenSub.packageTier === 'DROP_IN' && (chosenSub.remainingSessions ?? 0) > 0) {
        const [, att] = await this.prisma.$transaction([
          this.prisma.userSubscription.update({
            where: { id: chosenSub.id },
            data: { remainingSessions: { decrement: 1 } },
          }),
          this.prisma.attendance.create({
            data: {
              memberId: user.id,
              checkinType: 'GATE_ENTRY',
              notes: dto.notes ? `Thủ công PIN: ${dto.notes}` : 'Check-in thủ công mã PIN',
              verifiedById: actor.userId,
              towelIssued: dto.towelIssued ?? false,
            },
          }),
        ]);
        attendance = att;
      } else {
        attendance = await this.prisma.attendance.create({
          data: {
            memberId: user.id,
            checkinType: 'GATE_ENTRY',
            notes: dto.notes ? `Thủ công PIN: ${dto.notes}` : 'Check-in thủ công mã PIN',
            verifiedById: actor.userId,
            towelIssued: dto.towelIssued ?? false,
          },
        });
      }

      const checkinPayload = {
        type: 'MEMBER' as const,
        attendanceId: attendance.id,
        userId: user.id,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        planName: chosenSub.plan?.name || chosenSub.discipline?.name || 'Gói tập',
        packageTier: chosenSub.packageTier,
        startDate: chosenSub.startDate,
        endDate: chosenSub.endDate,
        remainingSessions: chosenSub.remainingSessions,
        remainingPtSessions: chosenSub.remainingPtSessions,
        remainingGroupSessions: chosenSub.remainingGroupSessions,
        checkinTime: attendance.checkInTime,
      };

      this.events.publish({
        name: 'frontdesk.qr-checkin',
        data: checkinPayload,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });

      return {
        success: true,
        isRepeated: false,
        type: 'MEMBER',
        message: 'Điểm danh vào cổng thành công!',
        user: { fullName: user.fullName, phone: user.phone, avatarUrl: user.avatarUrl },
        plan: {
          name: chosenSub.plan?.name || chosenSub.discipline?.name || 'Gói tập',
          packageTier: chosenSub.packageTier,
          startDate: chosenSub.startDate,
          endDate: chosenSub.endDate,
          remainingSessions: chosenSub.remainingSessions,
          remainingPtSessions: chosenSub.remainingPtSessions,
          remainingGroupSessions: chosenSub.remainingGroupSessions,
        },
        checkinTime: attendance.checkInTime,
      };
    }

    if (user.role === 'COACH') {
      const [coachProfile, recentCoachCheckin] = await Promise.all([
        this.prisma.coachProfile.findUnique({
          where: { userId: user.id },
          select: {
            ratingStars: true,
            coachSpecialties: {
              select: {
                specialty: {
                  select: {
                    name: true,
                    discipline: { select: { name: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.attendance.findFirst({
          where: {
            memberId: user.id,
            checkinType: 'GATE_ENTRY',
            checkInTime: { gte: fiveMinutesAgo },
          },
          select: { id: true, checkInTime: true },
          orderBy: { checkInTime: 'desc' },
        }),
      ]);

      if (!coachProfile) {
        throw new BadRequestException('Không tìm thấy thông tin Huấn luyện viên.');
      }

      const disciplinesList = Array.from(
        new Set(
          coachProfile.coachSpecialties
            .map((cs) => cs.specialty?.discipline?.name || cs.specialty?.name)
            .filter(Boolean),
        ),
      );
      const disciplinesDisplay = disciplinesList.length > 0 ? disciplinesList : ['Thể hình & Gym'];

      if (recentCoachCheckin) {
        return {
          success: true,
          isRepeated: true,
          type: 'COACH',
          message: 'Huấn luyện viên đã điểm danh gần đây!',
          user: {
            fullName: user.fullName,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            disciplines: disciplinesDisplay,
            ratingStars: coachProfile.ratingStars || 3,
          },
          checkinTime: recentCoachCheckin.checkInTime,
        };
      }

      const attendance = await this.prisma.attendance.create({
        data: {
          memberId: user.id,
          checkinType: 'GATE_ENTRY',
          notes: dto.notes ? `Thủ công PIN: ${dto.notes}` : 'HLV Check-in thủ công mã PIN',
          verifiedById: actor.userId,
          towelIssued: dto.towelIssued ?? false,
        },
      });

      const coachCheckinPayload = {
        type: 'COACH' as const,
        attendanceId: attendance.id,
        userId: user.id,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        planName: `HLV ${disciplinesDisplay.join(', ')}`,
        packageTier: 'COACH_GATE',
        disciplines: disciplinesDisplay,
        ratingStars: coachProfile.ratingStars || 3,
        checkinTime: attendance.checkInTime,
      };

      this.events.publish({
        name: 'frontdesk.qr-checkin',
        data: coachCheckinPayload,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });

      return {
        success: true,
        isRepeated: false,
        type: 'COACH',
        message: 'Huấn luyện viên điểm danh vào trung tâm thành công!',
        user: {
          fullName: user.fullName,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          disciplines: disciplinesDisplay,
          ratingStars: coachProfile.ratingStars || 3,
        },
        checkinTime: attendance.checkInTime,
      };
    }

    throw new BadRequestException('Chỉ cho phép điểm danh vào cổng đối với Hội viên và Huấn luyện viên.');
  }

  /**
   * Lấy danh sách điểm danh vào cổng hôm nay để hiển thị Live Feed trên quầy Lễ tân
   */
  async getLiveFeed() {
    const today = localDate();
    const dayStart = new Date(today.getTime() - 7 * 3600000);

    const records = await this.prisma.attendance.findMany({
      where: {
        checkinType: 'GATE_ENTRY',
        checkInTime: { gte: dayStart },
      },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true,
            role: true,
            subscriptions: {
              where: { status: 'ACTIVE' },
              select: {
                packageTier: true,
                startDate: true,
                endDate: true,
                remainingSessions: true,
                remainingPtSessions: true,
                plan: { select: { name: true, packageTier: true } },
              },
            },
            coachProfile: {
              select: {
                ratingStars: true,
                coachSpecialties: {
                  select: {
                    specialty: {
                      select: {
                        name: true,
                        discipline: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
      take: 20,
    });

    return records.map((r) => {
      const u = r.member;
      const isCoach = u?.role === 'COACH';
      if (isCoach) {
        const specs = u.coachProfile?.coachSpecialties
          ?.map((cs) => cs.specialty?.discipline?.name || cs.specialty?.name)
          .filter(Boolean) || [];
        return {
          attendanceId: r.id,
          type: 'COACH' as const,
          userId: u?.id,
          fullName: u?.fullName || 'HLV',
          phone: u?.phone,
          avatarUrl: u?.avatarUrl,
          disciplines: specs.length > 0 ? Array.from(new Set(specs)) : ['Thể hình & Gym'],
          ratingStars: u.coachProfile?.ratingStars || 3,
          checkinTime: r.checkInTime,
        };
      }

      const activeSubs = u?.subscriptions || [];
      const sub = (sortSubscriptionsByPriority(activeSubs)[0] as any);
      return {
        attendanceId: r.id,
        type: 'MEMBER' as const,
        userId: u?.id,
        fullName: u?.fullName || 'Học viên',
        phone: u?.phone,
        avatarUrl: u?.avatarUrl,
        planName: sub?.plan?.name || 'Gói tập hội viên',
        packageTier: sub?.packageTier || 'STANDARD',
        startDate: sub?.startDate,
        endDate: sub?.endDate,
        remainingSessions: sub?.remainingSessions,
        checkinTime: r.checkInTime,
      };
    });
  }
}
