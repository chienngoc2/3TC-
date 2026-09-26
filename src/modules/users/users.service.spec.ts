import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
describe('User role hierarchy', () => {
  const service = new UsersService({} as never, {} as never, {} as never);
  it.each([UserRole.ADMIN, UserRole.COACH, UserRole.MEMBER])('Admin cannot create %s', async role => {
    await expect(service.createUser({ role } as never, { userId: 'admin', role: UserRole.ADMIN })).rejects.toThrow('ROLE_HIERARCHY_VIOLATION');
  });
  it('Manager cannot elevate to Admin', async () => {
    await expect(service.createUser({ role: UserRole.ADMIN } as never, { userId: 'manager', role: UserRole.CENTER_MANAGER })).rejects.toThrow('ROLE_HIERARCHY_VIOLATION');
  });
});
