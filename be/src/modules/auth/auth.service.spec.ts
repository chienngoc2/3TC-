import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';

describe('Auth session security', () => {
  const jwt = new JwtService();
  const config = new ConfigService({
    JWT_ACCESS_SECRET: 'test-access',
    JWT_REFRESH_SECRET: 'test-refresh',
  });
  const user = {
    id: 'member',
    email: 'member@test.local',
    role: UserRole.MEMBER,
    isActive: true,
    tokenVersion: 1,
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
    userSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new AuthService(prisma as never, jwt, config, {} as never);
  beforeEach(() => jest.clearAllMocks());

  it('rejects access when session is absent or expired, even if user is active', async () => {
    prisma.userSession.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.validateAccess({
        sub: 'member',
        email: user.email,
        role: user.role,
        kind: 'access',
        sid: 'sid',
        tokenVersion: 1,
      }),
    ).rejects.toThrow('SESSION_REVOKED');
  });

  it('rejects access when tokenVersion mismatches (instant revocation on all devices)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ ...user, tokenVersion: 2 });
    await expect(
      service.validateAccess({
        sub: 'member',
        email: user.email,
        role: user.role,
        kind: 'access',
        sid: 'sid',
        tokenVersion: 1,
      }),
    ).rejects.toThrow('SESSION_REVOKED');
  });

  it('rejects replay and revokes all sessions when rotated refresh token is reused', async () => {
    const refreshToken = jwt.sign(
      {
        sub: 'member',
        email: user.email,
        role: user.role,
        kind: 'refresh',
        sid: 'sid',
        tokenVersion: 1,
      },
      { secret: 'test-refresh' },
    );
    prisma.user.findUnique.mockResolvedValueOnce(user);
    prisma.userSession.findUnique.mockResolvedValueOnce({
      id: 'sid',
      userId: user.id,
      refreshTokenHash: createHash('sha256')
        .update('different-token')
        .digest('hex'),
      expiresAt: new Date(Date.now() + 100000),
    });
    await expect(service.refreshToken({ refreshToken })).rejects.toThrow(
      'REFRESH_TOKEN_REUSED_OR_REVOKED',
    );
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
