import { LockersService } from './lockers.service';
import { LockerStatus, UserRole } from '@prisma/client';

describe('LockersService', () => {
  let service: LockersService;
  let mockPrisma: any;
  let mockTx: any;
  let mockTransactions: any;

  beforeEach(() => {
    mockTx = {
      locker: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      lockerAssignment: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    mockPrisma = {
      locker: {
        findMany: jest.fn(),
      },
      lockerAssignment: {
        findMany: jest.fn(),
      },
    };
    mockTransactions = {
      run: jest.fn().mockImplementation((cb) => cb(mockTx)),
    };
    service = new LockersService(
      mockPrisma as never,
      mockTransactions as never,
    );
  });

  describe('list', () => {
    it('returns lockers with formatted currentAssignment', async () => {
      mockPrisma.locker.findMany.mockResolvedValue([
        {
          id: 'l-1',
          lockerNumber: 'L01',
          zone: 'MALE_LOCKER',
          status: LockerStatus.OCCUPIED,
          isActive: true,
          assignments: [
            {
              id: 'a-1',
              userId: 'u-1',
              assignedAt: new Date('2026-11-19T08:00:00Z'),
              notes: 'Towel issued',
              user: {
                id: 'u-1',
                fullName: 'Nguyen Van A',
                phone: '0901234567',
                email: 'a@example.com',
                avatarUrl: null,
              },
            },
          ],
        },
        {
          id: 'l-2',
          lockerNumber: 'L02',
          zone: 'MALE_LOCKER',
          status: LockerStatus.AVAILABLE,
          isActive: true,
          assignments: [],
        },
      ]);

      const result = await service.list('MALE_LOCKER');
      expect(result).toHaveLength(2);
      expect(result[0].currentAssignment).toEqual({
        id: 'a-1',
        userId: 'u-1',
        assignedAt: new Date('2026-11-19T08:00:00Z'),
        notes: 'Towel issued',
        user: {
          id: 'u-1',
          fullName: 'Nguyen Van A',
          phone: '0901234567',
          email: 'a@example.com',
          avatarUrl: null,
        },
      });
      expect(result[1].currentAssignment).toBeNull();
    });
  });

  describe('release', () => {
    it('releases occupied locker and closes active assignment', async () => {
      mockTx.locker.findUnique.mockResolvedValue({
        id: 'l-1',
        lockerNumber: 'L01',
        status: LockerStatus.OCCUPIED,
      });
      mockTx.lockerAssignment.findFirst.mockResolvedValue({
        id: 'a-1',
        userId: 'u-1',
        lockerId: 'l-1',
        returnedAt: null,
      });
      mockTx.lockerAssignment.update.mockResolvedValue({
        id: 'a-1',
        returnedAt: new Date(),
      });
      mockTx.locker.update.mockResolvedValue({
        id: 'l-1',
        lockerNumber: 'L01',
        status: LockerStatus.AVAILABLE,
      });

      const actor = {
        userId: 'staff-1',
        role: UserRole.RECEPTIONIST,
      };

      const result = await service.release('l-1', actor as never);
      expect(result.id).toBe('l-1');
      expect(result.status).toBe(LockerStatus.AVAILABLE);
      expect(result.releasedAssignmentId).toBe('a-1');
      expect(mockTx.lockerAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a-1' },
          data: expect.objectContaining({ returnedAt: expect.any(Date) }),
        }),
      );
      expect(mockTx.locker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l-1' },
          data: { status: LockerStatus.AVAILABLE },
        }),
      );
    });

    it('rejects when locker is already AVAILABLE and has no assignment', async () => {
      mockTx.locker.findUnique.mockResolvedValue({
        id: 'l-2',
        lockerNumber: 'L02',
        status: LockerStatus.AVAILABLE,
      });
      mockTx.lockerAssignment.findFirst.mockResolvedValue(null);

      const actor = {
        userId: 'staff-1',
        role: UserRole.RECEPTIONIST,
      };

      await expect(service.release('l-2', actor as never)).rejects.toThrow(
        'LOCKER_NOT_OCCUPIED',
      );
    });
  });
});
