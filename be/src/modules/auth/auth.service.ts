import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendGoogleOtpDto, VerifyGoogleOtpDto } from './dto/google-auth.dto';
import { EmailService } from './email.service';
import { UserRole, UserGender } from '@prisma/client';
import { Actor } from '../../common/types/actor';

export interface SessionPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
  tokenVersion: number;
  kind: 'access' | 'refresh';
}

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpStore = new Map<string, { otp: string; expiresAt: number; fullName?: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly transactions: TransactionService,
    private readonly emailService: EmailService,
  ) {}

  async sendGoogleOtp(dto: SendGoogleOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

    this.otpStore.set(email, {
      otp,
      expiresAt,
      fullName: dto.fullName,
    });

    await this.emailService.sendOtpEmail(email, otp, dto.fullName);

    return {
      success: true,
      message: `Mã xác thực OTP đã được gửi đến email ${email}. Vui lòng kiểm tra hộp thư.`,
      email,
      expiresInSeconds: 300,
      debugOtp: otp,
    };
  }

  async verifyGoogleOtp(dto: VerifyGoogleOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const inputOtp = dto.otp.trim();

    const cached = this.otpStore.get(email);
    if (!cached || Date.now() > cached.expiresAt) {
      throw new BadRequestException('Mã xác thực OTP đã hết hạn hoặc không tồn tại. Vui lòng lấy mã mới.');
    }

    if (cached.otp !== inputOtp) {
      throw new BadRequestException('Mã xác thực OTP không chính xác. Vui lòng kiểm tra lại.');
    }

    // OTP is valid - remove from cache
    this.otpStore.delete(email);

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    const defaultPassword = 'Password123!';

    let isNewUser = false;

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản đã bị tạm khóa. Vui lòng liên hệ ban quản lý.');
      }
    } else {
      isNewUser = true;
      // Create new user with MEMBER role and default password
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      // Generate a unique phone number placeholder
      let phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
      let attempts = 0;
      while ((await this.prisma.user.findUnique({ where: { phone } })) && attempts < 10) {
        phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
        attempts++;
      }

      user = await this.transactions.run((tx) =>
        tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: dto.fullName || cached.fullName || email.split('@')[0],
            phone,
            avatarUrl: dto.avatarUrl,
            role: UserRole.MEMBER,
            gender: UserGender.OTHER,
            memberProfile: { create: {} },
          },
        }),
      );
    }

    // Chỉ gửi email thông tin tài khoản mặc định 1 lần duy nhất khi tạo tài khoản lần đầu
    if (isNewUser) {
      await this.emailService.sendDefaultAccountEmail(email, defaultPassword, user.fullName);
    }

    const session = await this.newSession(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        avatarUrl: user.avatarUrl,
        checkinCode: user.checkinCode || '1234',
      },
      ...session,
      ...(isNewUser
        ? {
            defaultAccount: {
              email: user.email,
              defaultPassword,
              message: 'Thông tin tài khoản mặc định đã được gửi đến email của bạn.',
            },
          }
        : {}),
    };
  }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.transactions.run((tx) =>
      tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          avatarUrl: dto.avatarUrl,
          role: UserRole.MEMBER,
          gender: dto.gender,
          memberProfile: { create: {} },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          gender: true,
          tokenVersion: true,
        },
      }),
    );
    return { user, ...(await this.newSession(user)) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    )
      throw new UnauthorizedException('INVALID_CREDENTIALS');

    const userWithProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        coachProfile: {
          include: {
            coachSpecialties: {
              include: {
                specialty: {
                  include: {
                    discipline: true,
                  },
                },
              },
            },
          },
        },
        memberProfile: true,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        avatarUrl: user.avatarUrl,
        checkinCode: user.checkinCode || '1234',
        coachProfile: userWithProfile?.coachProfile || null,
        memberProfile: userWithProfile?.memberProfile || null,
      },
      ...(await this.newSession(user)),
    };
  }

  private async pair(payload: Omit<SessionPayload, 'kind'>) {
    const accessToken = await this.jwt.signAsync(
      { ...payload, kind: 'access' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
        jwtid: randomUUID(),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...payload, kind: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
        jwtid: randomUUID(),
      },
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: '15m' };
  }

  private async newSession(user: {
    id: string;
    email: string;
    role: UserRole;
    tokenVersion: number;
  }) {
    const sid = randomUUID();
    const pair = await this.pair({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sid,
    });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: {
        id: sid,
        userId: user.id,
        refreshTokenHash: hash(pair.refreshToken),
        expiresAt,
      },
    });
    return pair;
  }

  async refreshToken(dto: RefreshTokenDto) {
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID_OR_EXPIRED');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      payload.kind !== 'refresh' ||
      !user?.isActive ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) {
        await this.prisma.userSession
          .delete({ where: { id: payload.sid } })
          .catch(() => {});
      }
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    const expectedHash = hash(dto.refreshToken);
    if (session.refreshTokenHash !== expectedHash) {
      // Replay attack detected: revoke all sessions for this user
      await this.prisma.userSession.deleteMany({ where: { userId: user.id } });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
      throw new UnauthorizedException('REFRESH_TOKEN_REUSED_OR_REVOKED');
    }

    const pair = await this.pair({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sid: payload.sid,
    });

    await this.prisma.userSession.update({
      where: { id: payload.sid },
      data: {
        refreshTokenHash: hash(pair.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return pair;
  }

  async validateAccess(
    payload: SessionPayload,
  ): Promise<Actor & { email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        isActive: true,
        tokenVersion: true,
      },
    });
    if (
      payload.kind !== 'access' ||
      !user?.isActive ||
      user.tokenVersion !== payload.tokenVersion ||
      !payload.sid
    ) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      select: { id: true, expiresAt: true },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    return {
      userId: user.id,
      role: user.role,
      email: user.email,
      sessionId: payload.sid,
    };
  }

  async logout(actor: Actor) {
    if (actor.sessionId) {
      await this.prisma.userSession
        .delete({ where: { id: actor.sessionId } })
        .catch(() => {});
    }
    return { message: 'Logged out' };
  }

  async revokeUser(userId: string) {
    await this.prisma.userSession
      .deleteMany({ where: { userId } })
      .catch(() => {});
    await this.prisma.user
      .update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      })
      .catch(() => {});
  }
}
