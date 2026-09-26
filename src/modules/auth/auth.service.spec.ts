import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
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
  };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const redis = { get: jest.fn(), rotate: jest.fn(), del: jest.fn() };
  const service = new AuthService(
    prisma as never,
    jwt,
    config,
    redis as never,
    {} as never,
  );
  beforeEach(() => jest.clearAllMocks());
  it('rejects access when session is absent, even if user is active', async () => {
    redis.get.mockResolvedValueOnce('epoch').mockResolvedValueOnce(null);
    await expect(
      service.validateAccess({
        sub: 'member',
        email: user.email,
        role: user.role,
        kind: 'access',
        sid: 'sid',
        epoch: 'epoch',
      }),
    ).rejects.toThrow('SESSION_REVOKED');
  });
  it('rejects replay and revokes the session after atomic rotation fails', async () => {
    const refreshToken = jwt.sign(
      {
        sub: 'member',
        email: user.email,
        role: user.role,
        kind: 'refresh',
        sid: 'sid',
        epoch: 'epoch',
      },
      { secret: 'test-refresh' },
    );
    redis.get.mockResolvedValue('epoch');
    redis.rotate.mockResolvedValue(false);
    await expect(service.refreshToken({ refreshToken })).rejects.toThrow(
      'REFRESH_TOKEN_REUSED_OR_REVOKED',
    );
    expect(redis.del).toHaveBeenCalledWith('auth:session:sid');
  });
});
