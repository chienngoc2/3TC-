import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
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
  epoch: string;
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
    private readonly redis: RedisService,
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
          memberProfile: { create: {} },
        },
        select: { id: true, email: true, fullName: true, role: true },
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
  }) {
    const epoch = await this.redis.epoch(user.id, randomUUID());
    const sid = randomUUID();
    const pair = await this.pair({
      sub: user.id,
      email: user.email,
      role: user.role,
      epoch,
      sid,
    });
    await this.redis.set(`auth:session:${sid}`, hash(pair.refreshToken));
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
      (await this.redis.get(`auth:user:${user.id}`)) !== payload.epoch
    )
      throw new UnauthorizedException('SESSION_REVOKED');
    const pair = await this.pair({
      sub: user.id,
      email: user.email,
      role: user.role,
      epoch: payload.epoch,
      sid: payload.sid,
    });
    if (
      !(await this.redis.rotate(
        `auth:session:${payload.sid}`,
        hash(dto.refreshToken),
        hash(pair.refreshToken),
      ))
    ) {
      await this.redis.del(`auth:session:${payload.sid}`);
      throw new UnauthorizedException('REFRESH_TOKEN_REUSED_OR_REVOKED');
    }
    return pair;
  }
  async validateAccess(
    payload: SessionPayload,
  ): Promise<Actor & { email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      payload.kind !== 'access' ||
      !user?.isActive ||
      !payload.sid ||
      (await this.redis.get(`auth:user:${user.id}`)) !== payload.epoch ||
      !(await this.redis.get(`auth:session:${payload.sid}`))
    )
      throw new UnauthorizedException('SESSION_REVOKED');
    return {
      userId: user.id,
      role: user.role,
      email: user.email,
      sessionId: payload.sid,
    };
  }
  async logout(actor: Actor) {
    if (actor.sessionId)
      await this.redis.del(`auth:session:${actor.sessionId}`);
    return { message: 'Logged out' };
  }
}
