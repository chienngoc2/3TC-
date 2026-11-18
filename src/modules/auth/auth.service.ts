import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole } from '@prisma/client';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly transactions: TransactionService,
  ) {}

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
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        gender: user.gender,
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
