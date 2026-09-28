import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { configureApp } from '../src/config/configure-app';
import { isolatedDatabase } from './helpers/database';
import { SessionStore } from './helpers/session-store';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { BillingService } from '../src/modules/billing/billing.service';
import { SchedulesService } from '../src/modules/schedules/schedules.service';
import { CoachesService } from '../src/modules/coaches/coaches.service';
import { AttendancesService } from '../src/modules/attendances/attendances.service';
import { CancellationReviewService } from '../src/modules/bookings/cancellation-review.service';
import { MembershipsService } from '../src/modules/memberships/memberships.service';
import { InbodyService } from '../src/modules/inbody/inbody.service';
import { StaffShiftsService } from '../src/modules/staff-shifts/staff-shifts.service';
import { Actor } from '../src/common/types/actor';
import { localDate, addDays } from '../src/common/utils/domain';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { DomainEvents } from '../src/common/events/domain-events';
import { LockersService } from '../src/modules/lockers/lockers.service';
import { WorkoutPlansService } from '../src/modules/workout-plans/workout-plans.service';

jest.setTimeout(180000);
describe('Backend phases 1–5 (isolated PostgreSQL + HTTP)', () => {
  let app: INestApplication, db: PrismaClient, cleanup: () => Promise<void>;
  let liveRedis: RedisService | undefined;
  let redisPrefix: string;
  let manager: Actor,
    receptionist: Actor,
    coach: Actor,
    members: Actor[],
    admin: Actor;
  let disciplineId: string,
    gymId: string,
    classId: string,
    roomId: string,
    planId: string,
    vipId: string,
    gymPlanId: string;
  let bookings: BookingsService,
    billing: BillingService,
    schedules: SchedulesService,
    coaches: CoachesService,
    attendances: AttendancesService,
    reviews: CancellationReviewService;
  const tokens = new Map<string, string>();
  let slotCounter = 0;
  const future = () => {
    const start = new Date(Date.now() + (48 + slotCounter++ * 2) * 3600000);
    return {
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + 3600000).toISOString(),
    };
  };
  const payment = { paymentMethod: 'CASH' as const };
  const passed = (results: PromiseSettledResult<unknown>[]) =>
    results.filter((result) => result.status === 'fulfilled');
  const api = () => request(app.getHttpServer());
  async function login(actor: Actor) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    const response = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Testing123!' })
      .expect(200);
    tokens.set(actor.userId, response.body.data.accessToken);
    return response.body.data;
  }
  async function purchase(member: Actor, vip = false) {
    return billing.purchase(
      {
        memberId: member.userId,
        planId: vip ? vipId : planId,
        ...(vip ? { coachId: coach.userId } : {}),
        ...payment,
      },
      receptionist,
    );
  }
  async function newSchedule(capacity = 1) {
    return schedules.create(
      { classId, roomId, coachId: coach.userId, capacity, ...future() },
      manager,
    );
  }
  beforeAll(async () => {
    ({ prisma: db, cleanup } = await isolatedDatabase());
    let sessionStore: RedisService | SessionStore = new SessionStore();
    if (process.env.TEST_REDIS_URL) {
      const redisUrl = new URL(process.env.TEST_REDIS_URL);
      redisPrefix = `backend_e2e:${Date.now()}:`;
      liveRedis = new RedisService(
        new ConfigService({
          REDIS_HOST: redisUrl.hostname,
          REDIS_PORT: Number(redisUrl.port || 6379),
          REDIS_PASSWORD: redisUrl.password,
          REDIS_KEY_PREFIX: redisPrefix,
        }),
      );
      sessionStore = liveRedis;
    }
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(RedisService)
      .useValue(sessionStore)
      .compile();
    app = fixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    bookings = app.get(BookingsService);
    billing = app.get(BillingService);
    schedules = app.get(SchedulesService);
    coaches = app.get(CoachesService);
    attendances = app.get(AttendancesService);
    reviews = app.get(CancellationReviewService);
    const passwordHash = await bcrypt.hash('Testing123!', 4);
    async function user(role: UserRole, index: number): Promise<Actor> {
      const value = await db.user.create({
        data: {
          email: `user${index}@test.invalid`,
          phone: `09${String(index).padStart(8, '0')}`,
          fullName: `Test ${index}`,
          passwordHash,
          role,
          ...(role === 'COACH' ? { coachProfile: { create: {} } } : {}),
          ...(role === 'MEMBER' ? { memberProfile: { create: {} } } : {}),
        },
      });
      return { userId: value.id, role };
    }
    admin = await user('ADMIN', 1);
    manager = await user('CENTER_MANAGER', 2);
    receptionist = await user('RECEPTIONIST', 3);
    coach = await user('COACH', 4);
    members = [];
    for (let i = 0; i < 24; i++) members.push(await user('MEMBER', i + 10));
    const discipline = await db.discipline.create({
      data: { code: 'YOGA', name: 'Yoga' },
    });
    disciplineId = discipline.id;
    gymId = (await db.discipline.create({ data: { code: 'GYM', name: 'Gym' } }))
      .id;
    const specialty = await db.specialty.create({
      data: { code: 'YOGA_BASIC', name: 'Yoga Basic', disciplineId },
    });
    const profile = await db.coachProfile.findUniqueOrThrow({
      where: { userId: coach.userId },
    });
    await db.coachSpecialty.create({
      data: { coachProfileId: profile.id, specialtyId: specialty.id },
    });
    await db.coachRate.create({
      data: {
        coachId: coach.userId,
        ratePerSession: 100000,
        effectiveFrom: addDays(localDate(), -10),
        effectiveTo: addDays(localDate(), 1),
      },
    });
    classId = (
      await db.class.create({ data: { name: 'Basic Yoga', disciplineId } })
    ).id;
    roomId = (await db.room.create({ data: { name: 'Room A', capacity: 20 } }))
      .id;
    const plans = app.get(MembershipsService);
    planId = (
      await plans.create(
        {
          name: 'Yoga Plus',
          disciplineId,
          price: 1000000,
          durationDays: 90,
          packageTier: 'PLUS',
          trainingMode: 'GROUP_CLASS',
          groupSessionQuota: 15,
          ptSessionQuota: 0,
          unlimitedGymEntry: false,
        },
        manager,
      )
    ).id;
    vipId = (
      await plans.create(
        {
          name: 'Yoga VIP',
          disciplineId,
          price: 1000000,
          durationDays: 90,
          packageTier: 'VIP',
          trainingMode: 'HYBRID',
          groupSessionQuota: 15,
          ptSessionQuota: 12,
          unlimitedGymEntry: false,
        },
        manager,
      )
    ).id;
    gymPlanId = (
      await plans.create(
        {
          name: 'Gym Plus',
          disciplineId: gymId,
          price: 300000,
          durationDays: 30,
          packageTier: 'PLUS',
          trainingMode: 'CUSTOM',
          groupSessionQuota: 0,
          ptSessionQuota: 0,
          unlimitedGymEntry: true,
        },
        manager,
      )
    ).id;
    for (const actor of [
      admin,
      manager,
      receptionist,
      coach,
      members[0],
      members[1],
    ])
      await login(actor);
  });
  afterAll(async () => {
    try {
      if (liveRedis)
        await liveRedis
          .getClient()
          .eval(
            "local cursor='0' repeat local result=redis.call('SCAN',cursor,'MATCH',ARGV[1]..'*','COUNT',100) cursor=result[1] for _,key in ipairs(result[2]) do redis.call('DEL',key) end until cursor=='0' return 1",
            0,
            redisPrefix,
          );
    } finally {
      try {
        if (app) await app.close();
      } finally {
        if (cleanup) await cleanup();
      }
    }
  });

  it('uses global auth, validates payloads and enforces the two-tier account hierarchy', async () => {
    await api().get('/api/v1/rooms').expect(401);
    await api().get('/api/v1/disciplines').expect(200);
    await api()
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${tokens.get(members[0].userId)}`)
      .send({ name: 'X', capacity: 1 })
      .expect(403);
    await api()
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${tokens.get(manager.userId)}`)
      .send({ name: 'X', capacity: '10', unexpected: true })
      .expect(400);
    await api()
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokens.get(manager.userId)}`)
      .send({
        email: 'escalate@test.invalid',
        phone: '0888888888',
        fullName: 'Escalate',
        password: 'Testing123!',
        role: 'ADMIN',
      })
      .expect(403);
    await api()
      .get(`/api/v1/memberships/subscriptions?memberId=${members[1].userId}`)
      .set('Authorization', `Bearer ${tokens.get(members[0].userId)}`)
      .expect(403);
  });
  it('rotates refresh tokens, rejects replay and revokes access after logout', async () => {
    const pair = await login(members[0]);
    const refreshed = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: pair.refreshToken })
      .expect(200);
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: pair.refreshToken })
      .expect(401);
    await api()
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`)
      .expect(401);
    const next = await login(members[0]);
    await api()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${next.accessToken}`)
      .expect(200);
    await api()
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${next.accessToken}`)
      .expect(401);
    await login(members[0]);
  });
  it('calculates VIP price and PT add-ons using immutable invoice snapshots', async () => {
    // Legacy seed once marked Yoga VIP as unlimited Gym; new sales normalize that flag.
    await db.membershipPlan.update({
      where: { id: vipId },
      data: { unlimitedGymEntry: true },
    });
    const sold = await purchase(members[0], true);
    expect(sold.subscription.hasUnlimitedGymAccess).toBe(false);
    await db.membershipPlan.update({
      where: { id: vipId },
      data: { unlimitedGymEntry: false },
    });
    expect(Number(sold.invoice.amount)).toBe(2200000);
    expect(sold.subscription.remainingPtSessions).toBe(12);
    const added = await billing.addon(
      sold.subscription.id,
      { sessions: 2, ...payment },
      receptionist,
    );
    expect(Number(added.invoice.amount)).toBe(200000);
    expect(added.subscription.remainingPtSessions).toBe(14);
    await db.coachRate.updateMany({
      where: { coachId: coach.userId },
      data: { ratePerSession: 150000 },
    });
    const historical = await db.invoice.findUniqueOrThrow({
      where: { id: sold.invoice.id },
    });
    expect(Number(historical.amount)).toBe(2200000);
    const renewed = await billing.renew(
      sold.subscription.id,
      payment,
      receptionist,
    );
    expect(renewed.subscription.startDate).toEqual(
      addDays(sold.subscription.endDate, 1),
    );
    expect(Number(renewed.invoice.amount)).toBe(2800000);
  });
  it('rejects repeated trial purchase and invalid Gym group plans', async () => {
    const plans = app.get(MembershipsService);
    await expect(
      plans.create(
        {
          name: 'Invalid',
          disciplineId: gymId,
          price: 1,
          durationDays: 30,
          packageTier: 'PLUS',
          trainingMode: 'GROUP_CLASS',
          groupSessionQuota: 5,
          ptSessionQuota: 0,
          unlimitedGymEntry: false,
        },
        manager,
      ),
    ).rejects.toThrow('GYM_GROUP_PLAN_FORBIDDEN');
    const trial = await plans.create(
      {
        name: 'Trial',
        disciplineId,
        price: 0,
        durationDays: 7,
        packageTier: 'TRIAL',
        trainingMode: 'GROUP_CLASS',
        groupSessionQuota: 3,
        ptSessionQuota: 0,
        unlimitedGymEntry: false,
      },
      manager,
    );
    await billing.purchase(
      { planId: trial.id, memberId: members[22].userId, ...payment },
      receptionist,
    );
    await expect(
      billing.purchase(
        { planId: trial.id, memberId: members[22].userId, ...payment },
        receptionist,
      ),
    ).rejects.toThrow('TRIAL_ALREADY_USED');
  });
  it('allows exactly one of 20 concurrent requests to claim the last class seat', async () => {
    for (const member of members.slice(0, 20)) await purchase(member);
    const before = await db.userSubscription.aggregate({
      _sum: { remainingGroupSessions: true },
    });
    const schedule = await newSchedule();
    const results = await Promise.allSettled(
      members
        .slice(0, 20)
        .map((member) => bookings.group({ scheduleId: schedule.id }, member)),
    );
    expect(passed(results)).toHaveLength(1);
    const stored = await db.schedule.findUniqueOrThrow({
      where: { id: schedule.id },
    });
    expect(stored.currentEnrolled).toBe(1);
    expect(stored.status).toBe('FULL');
    expect(await db.booking.count({ where: { scheduleId: schedule.id } })).toBe(
      1,
    );
    const quota = await db.userSubscription.aggregate({
      _sum: { remainingGroupSessions: true },
    });
    expect(quota._sum.remainingGroupSessions).toBe(
      before._sum.remainingGroupSessions! - 1,
    );
  });
  it('chooses the closest expiry contract and refunds it exactly once on concurrent cancellation', async () => {
    const member = members[20],
      first = await purchase(member),
      second = await purchase(member);
    await db.userSubscription.update({
      where: { id: first.subscription.id },
      data: { endDate: addDays(localDate(), 25) },
    });
    const schedule = await newSchedule(),
      booking = await bookings.group({ scheduleId: schedule.id }, member);
    expect(booking.subscriptionId).toBe(first.subscription.id);
    const outcomes = await Promise.allSettled([
      bookings.cancel(booking.id, {}, member),
      bookings.cancel(booking.id, {}, member),
    ]);
    expect(passed(outcomes)).toHaveLength(1);
    expect(
      (
        await db.userSubscription.findUniqueOrThrow({
          where: { id: first.subscription.id },
        })
      ).remainingGroupSessions,
    ).toBe(15);
    expect(
      (
        await db.userSubscription.findUniqueOrThrow({
          where: { id: second.subscription.id },
        })
      ).remainingGroupSessions,
    ).toBe(15);
    expect(
      (await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } }))
        .currentEnrolled,
    ).toBe(0);
  });
  it('holds one PT slot for exactly one member and refunds once on concurrent emergency approval', async () => {
    const a = members[21],
      b = members[23];
    await purchase(a, true);
    await purchase(b, true);
    const slot = await coaches.createSlot(future(), coach);
    const outcomes = await Promise.allSettled([
      bookings.pt({ coachAvailabilityId: slot.id, disciplineId }, a),
      bookings.pt({ coachAvailabilityId: slot.id, disciplineId }, b),
    ]);
    expect(passed(outcomes)).toHaveLength(1);
    const booking = await db.booking.findFirstOrThrow({
      where: { coachAvailabilityId: slot.id, status: 'CONFIRMED' },
    });
    const request = await reviews.request(
      {
        bookingId: booking.id,
        reasonMessage: 'Emergency medical appointment for coach',
      },
      coach,
    );
    const results = await Promise.allSettled([
      reviews.review(request.id, { approve: true }, manager),
      reviews.review(request.id, { approve: true }, receptionist),
    ]);
    expect(passed(results)).toHaveLength(1);
    const stored = await db.coachAvailability.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(stored.isEmergencyCancelled).toBe(true);
    expect(stored.isBooked).toBe(false);
    expect(
      (
        await db.userSubscription.findUniqueOrThrow({
          where: { id: booking.subscriptionId },
        })
      ).remainingPtSessions,
    ).toBe(12);
    expect(
      await db.coachPenalty.count({
        where: { cancellationRequestId: request.id },
      }),
    ).toBe(1);
    await expect(
      bookings.pt({ coachAvailabilityId: slot.id, disciplineId }, a),
    ).rejects.toThrow('PT_SLOT_UNAVAILABLE');
  });
  it('cancels a group session and records one DSS violation for multiple refunded members', async () => {
    const schedule = await newSchedule(2);
    await bookings.group({ scheduleId: schedule.id }, members[2]);
    await bookings.group({ scheduleId: schedule.id }, members[3]);
    const req = await reviews.request(
      {
        scheduleId: schedule.id,
        reasonMessage: 'Coach requires emergency medical leave today',
      },
      coach,
    );
    const reviewed = await reviews.review(
      req.id,
      { approve: true },
      receptionist,
    );
    expect(reviewed.isFrontdeskOverride).toBe(true);
    expect(
      await db.booking.count({
        where: { scheduleId: schedule.id, status: 'CANCELLED' },
      }),
    ).toBe(2);
    expect(
      await db.coachPenalty.count({ where: { cancellationRequestId: req.id } }),
    ).toBe(1);
    expect(
      (await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } }))
        .status,
    ).toBe('CANCELLED_BY_COACH');
  });
  it('prevents concurrent group/PT overlapping coach schedules', async () => {
    const time = future();
    const outcomes = await Promise.allSettled([
      schedules.create(
        { classId, roomId, coachId: coach.userId, capacity: 1, ...time },
        manager,
      ),
      coaches.createSlot(time, coach),
    ]);
    expect(passed(outcomes)).toHaveLength(1);
  });
  it('freezes access and restores the contract period on unfreeze', async () => {
    await db.userSubscription.updateMany({
      where: { userId: members[20].userId },
      data: { status: 'FROZEN', frozenAt: new Date() },
    });
    const sold = await billing.purchase(
      { planId: gymPlanId, memberId: members[20].userId, ...payment },
      receptionist,
    );
    await app
      .get(MembershipsService)
      .status(sold.subscription.id, { status: 'FROZEN' }, manager);
    await expect(
      attendances.gate({ memberId: members[20].userId }, receptionist),
    ).rejects.toThrow('GATE_ACCESS_DENIED');
    await db.userSubscription.update({
      where: { id: sold.subscription.id },
      data: { frozenAt: addDays(new Date(), -3) },
    });
    const restored = await app
      .get(MembershipsService)
      .status(sold.subscription.id, { status: 'ACTIVE' }, manager);
    expect(restored.endDate).toEqual(addDays(sold.subscription.endDate, 3));
  });
  it('atomically allocates one locker across two front-desk gate check-ins', async () => {
    for (const member of [members[0], members[1]])
      await billing.purchase(
        { planId: gymPlanId, memberId: member.userId, ...payment },
        receptionist,
      );
    await db.locker.create({
      data: { lockerNumber: 'M01', zone: 'MALE_LOCKER' },
    });
    const results = await Promise.allSettled([
      attendances.gate(
        {
          memberId: members[0].userId,
          lockerZone: 'MALE_LOCKER',
          towelIssued: true,
        },
        receptionist,
      ),
      attendances.gate(
        { memberId: members[1].userId, lockerZone: 'MALE_LOCKER' },
        manager,
      ),
    ]);
    expect(passed(results)).toHaveLength(1);
    expect(
      await db.lockerAssignment.count({ where: { returnedAt: null } }),
    ).toBe(1);
    const winner = await db.lockerAssignment.findFirstOrThrow({
      where: { returnedAt: null },
    });
    const repeated = await attendances.gate(
      { memberId: winner.userId, lockerZone: 'MALE_LOCKER' },
      receptionist,
    );
    expect(repeated.repeated).toBe(true);
    expect(
      await db.attendance.count({
        where: { checkinType: 'GATE_ENTRY', memberId: winner.userId },
      }),
    ).toBe(1);
  });
  it('enforces InBody ownership and the 24-hour correction window', async () => {
    const service = app.get(InbodyService),
      log = await service.create(
        { userId: members[0].userId, heightCm: 170, weightKg: 65 },
        receptionist,
      );
    await expect(
      service.progress(members[0].userId, members[1]),
    ).rejects.toThrow('FORBIDDEN_RESOURCE');
    await db.memberInbodyLog.update({
      where: { id: log.id },
      data: { measuredAt: addDays(new Date(), -2) },
    });
    await expect(
      service.update(log.id, { weightKg: 66 }, receptionist),
    ).rejects.toThrow('INBODY_EDIT_WINDOW_EXPIRED');
  });
  it('prevents staff-shift and coach-rate interval overlap', async () => {
    const shifts = app.get(StaffShiftsService),
      time = future();
    await shifts.create(
      {
        staffId: receptionist.userId,
        shiftDate: localDate(new Date(time.startTime)).toISOString(),
        ...time,
      },
      manager,
    );
    await expect(
      shifts.create(
        {
          staffId: receptionist.userId,
          shiftDate: localDate(new Date(time.startTime)).toISOString(),
          ...time,
        },
        manager,
      ),
    ).rejects.toThrow();
    await expect(
      coaches.createRate(
        coach.userId,
        { ratePerSession: 200000, effectiveFrom: localDate().toISOString() },
        manager,
      ),
    ).rejects.toThrow();
  });
  it('releases a late cancellation without refund and rejects cancellation after session start', async () => {
    const member = members[4],
      schedule = await newSchedule(),
      booking = await bookings.group({ scheduleId: schedule.id }, member);
    const before = await db.userSubscription.findUniqueOrThrow({
      where: { id: booking.subscriptionId },
    });
    await db.schedule.update({
      where: { id: schedule.id },
      data: {
        startTime: new Date(Date.now() + 1800000),
        endTime: new Date(Date.now() + 5400000),
      },
    });
    expect((await bookings.cancel(booking.id, {}, member)).refunded).toBe(
      false,
    );
    expect(
      (
        await db.userSubscription.findUniqueOrThrow({
          where: { id: booking.subscriptionId },
        })
      ).remainingGroupSessions,
    ).toBe(before.remainingGroupSessions);
    const past = await newSchedule(),
      pastBooking = await bookings.group({ scheduleId: past.id }, members[5]);
    // Complete the previous empty schedule before moving another fixture into this interval.
    await db.schedule.update({
      where: { id: schedule.id },
      data: { status: 'COMPLETED' },
    });
    await db.schedule.update({
      where: { id: past.id },
      data: {
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() - 1000),
      },
    });
    await expect(
      bookings.cancel(pastBooking.id, {}, members[5]),
    ).rejects.toThrow('SESSION_ALREADY_STARTED');
    await expect(
      attendances.session(
        { bookingId: pastBooking.id, status: 'PRESENT' },
        manager,
      ),
    ).rejects.toThrow('FORBIDDEN_RESOURCE');
    const attended = await attendances.session(
      { bookingId: pastBooking.id, status: 'PRESENT' },
      coach,
    );
    expect(attended.status).toBe('PRESENT');
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: pastBooking.id } }))
        .status,
    ).toBe('ATTENDED');
    await attendances.session(
      { bookingId: pastBooking.id, status: 'LATE' },
      coach,
    );
    expect(
      await db.attendance.count({ where: { bookingId: pastBooking.id } }),
    ).toBe(1);
    await db.attendance.update({
      where: { id: attended.id },
      data: { checkInTime: addDays(new Date(), -2) },
    });
    await expect(
      attendances.session(
        { bookingId: pastBooking.id, status: 'ABSENT' },
        coach,
      ),
    ).rejects.toThrow('ATTENDANCE_EDIT_WINDOW_CLOSED');
    await db.schedule.update({
      where: { id: past.id },
      data: { status: 'COMPLETED' },
    });
  });
  it('accepts today’s valid booking at the gate even when group quota is exhausted', async () => {
    const schedule = await newSchedule(),
      member = members[6],
      booking = await bookings.group({ scheduleId: schedule.id }, member);
    await db.schedule.update({
      where: { id: schedule.id },
      data: {
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(Date.now() + 3600000),
      },
    });
    await db.userSubscription.update({
      where: { id: booking.subscriptionId },
      data: { remainingGroupSessions: 0, remainingSessions: 0 },
    });
    const checked = await attendances.gate(
      { memberId: member.userId, towelIssued: true },
      receptionist,
    );
    expect(checked.attendance.towelIssued).toBe(true);
    await db.schedule.update({
      where: { id: schedule.id },
      data: { status: 'COMPLETED' },
    });
  });
  it('rejects future and expired Gym access and consumes a Gym drop-in only once', async () => {
    const member = members[22],
      sold = await billing.purchase(
        { planId: gymPlanId, memberId: member.userId, ...payment },
        receptionist,
      );
    await db.userSubscription.updateMany({
      where: { userId: member.userId, id: { not: sold.subscription.id } },
      data: { status: 'EXPIRED' },
    });
    await db.userSubscription.update({
      where: { id: sold.subscription.id },
      data: { startDate: addDays(localDate(), 1) },
    });
    await expect(
      attendances.gate({ memberId: member.userId }, receptionist),
    ).rejects.toThrow('GATE_ACCESS_DENIED');
    await db.userSubscription.update({
      where: { id: sold.subscription.id },
      data: {
        startDate: addDays(localDate(), -31),
        endDate: addDays(localDate(), -1),
      },
    });
    await expect(
      attendances.gate({ memberId: member.userId }, receptionist),
    ).rejects.toThrow('GATE_ACCESS_DENIED');
    const plan = await app.get(MembershipsService).create(
      {
        name: 'Gym Drop-in',
        disciplineId: gymId,
        price: 50000,
        durationDays: 1,
        packageTier: 'DROP_IN',
        trainingMode: 'CUSTOM',
        groupSessionQuota: 0,
        ptSessionQuota: 0,
        unlimitedGymEntry: false,
      },
      manager,
    );
    const dropin = await billing.purchase(
      { planId: plan.id, memberId: member.userId, ...payment },
      receptionist,
    );
    const results = await Promise.allSettled([
      attendances.gate({ memberId: member.userId }, receptionist),
      attendances.gate({ memberId: member.userId }, manager),
    ]);
    expect(passed(results)).toHaveLength(1);
    expect(
      (
        await db.userSubscription.findUniqueOrThrow({
          where: { id: dropin.subscription.id },
        })
      ).remainingSessions,
    ).toBe(0);
  });
  it('returns a locker once and prevents another member from returning it', async () => {
    const assignment = await db.lockerAssignment.findFirstOrThrow({
      where: { returnedAt: null },
    });
    const owner = members.find(
      (member) => member.userId === assignment.userId,
    )!;
    const other = members.find(
      (member) => member.userId !== assignment.userId,
    )!;
    await expect(
      app.get(LockersService).return(assignment.id, other),
    ).rejects.toThrow('FORBIDDEN_RESOURCE');
    const results = await Promise.allSettled([
      app.get(LockersService).return(assignment.id, owner),
      app.get(LockersService).return(assignment.id, receptionist),
    ]);
    expect(passed(results)).toHaveLength(1);
    expect(
      (
        await db.locker.findUniqueOrThrow({
          where: { id: assignment.lockerId },
        })
      ).status,
    ).toBe('AVAILABLE');
  });
  it('authenticates real Socket.IO connections, isolates member rooms and revokes live sessions', async () => {
    const endpoint = `${await app.getUrl()}/realtime`;
    const sockets: ClientSocket[] = [];
    async function connect(token?: string) {
      const socket = io(endpoint, {
        transports: ['websocket'],
        auth: { token },
        forceNew: true,
        reconnection: false,
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      return socket;
    }
    try {
      await expect(connect()).rejects.toThrow('UNAUTHORIZED');
      const ownerPair = await login(members[0]),
        otherPair = await login(members[1]);
      const owner = await connect(ownerPair.accessToken),
        other = await connect(otherPair.accessToken);
      const pong = new Promise((resolve) => owner.once('pong', resolve));
      owner.emit('ping');
      expect(await pong).toEqual({ timestamp: expect.any(String) });
      // Socket connect fires before its async room joins are observable; server ping confirms readiness.
      await new Promise((resolve) => setTimeout(resolve, 100));
      let leaked = false;
      other.on('private.fixture', () => {
        leaked = true;
      });
      const delivered = new Promise((resolve) =>
        owner.once('private.fixture', resolve),
      );
      app.get(DomainEvents).publish({
        name: 'private.fixture',
        data: { marker: 'member-only' },
        userIds: [members[0].userId],
      });
      expect(await delivered).toEqual({ marker: 'member-only' });
      expect(leaked).toBe(false);
      await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${ownerPair.accessToken}`)
        .expect(200);
      const disconnected = new Promise((resolve) =>
        owner.once('disconnect', resolve),
      );
      app.get(DomainEvents).publish({
        name: 'private.fixture',
        data: {},
        userIds: [members[0].userId],
      });
      await disconnected;
      expect(owner.connected).toBe(false);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
    }
  });
  it('exposes the documented VIP, add-on, group-class, gate and review request bodies', async () => {
    const staffToken = tokens.get(receptionist.userId);
    const sale = await api()
      .post('/api/v1/billing/subscriptions/vip')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        userId: members[7].userId,
        planId: vipId,
        coachId: coach.userId,
        paymentMethod: 'CASH',
      })
      .expect(201);
    expect(sale.body.data.totalAmount).toBe('2800000');
    const addon = await api()
      .post(
        `/api/v1/billing/subscriptions/${sale.body.data.subscriptionId}/pt-addon`,
      )
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ addonSessions: 2, paymentMethod: 'CARD' })
      .expect(200);
    expect(addon.body.data.newRemainingPtSessions).toBe(14);
    const memberPair = await login(members[7]),
      schedule = await newSchedule();
    const booked = await api()
      .post('/api/v1/bookings/group-class')
      .set('Authorization', `Bearer ${memberPair.accessToken}`)
      .send({ scheduleId: schedule.id })
      .expect(201);
    expect(booked.body.data.status).toBe('CONFIRMED');
    const request = await api()
      .post('/api/v1/coaches/cancellation-requests')
      .set('Authorization', `Bearer ${tokens.get(coach.userId)}`)
      .send({
        targetType: 'GROUP_CLASS',
        scheduleId: schedule.id,
        bookingId: null,
        reasonMessage: 'A genuine emergency requires cancellation',
      })
      .expect(201);
    await api()
      .put(`/api/v1/cancellation-requests/${request.body.data.id}/review`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        action: 'REJECT',
        rejectionReason: 'Replacement coach can cover this shift',
      })
      .expect(200);
    expect(
      (
        await db.booking.findUniqueOrThrow({
          where: { id: booked.body.data.id },
        })
      ).status,
    ).toBe('CONFIRMED');
    await api()
      .post('/api/v1/attendances/gate-checkin')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ userId: members[20].userId, towelIssued: true })
      .expect(200);
    await api()
      .get('/api/v1/analytics/revenue')
      .set('Authorization', `Bearer ${memberPair.accessToken}`)
      .expect(403);
    const revenue = await api()
      .get('/api/v1/analytics/revenue')
      .set('Authorization', `Bearer ${tokens.get(manager.userId)}`)
      .expect(200);
    expect(revenue.body.data.totalRevenue).toBe(
      revenue.body.data.baseRevenue + revenue.body.data.ptRevenue,
    );
    expect(revenue.body.data.byDiscipline.YOGA).toBeGreaterThan(0);
    await api().get('/api/v1/health').expect(200);
    await api()
      .get('/api/v1/inbody/my-progress?memberId=not-a-uuid')
      .set('Authorization', `Bearer ${memberPair.accessToken}`)
      .expect(400);
  });
  it('preserves a single remaining quota when two different sessions are booked concurrently', async () => {
    const member = members[9];
    await db.userSubscription.updateMany({
      where: { userId: member.userId, status: 'ACTIVE' },
      data: { remainingGroupSessions: 1, remainingSessions: 1 },
    });
    const a = await newSchedule(),
      b = await newSchedule();
    const results = await Promise.allSettled([
      bookings.group({ scheduleId: a.id }, member),
      bookings.group({ scheduleId: b.id }, member),
    ]);
    expect(passed(results)).toHaveLength(1);
    expect(
      await db.booking.count({
        where: { scheduleId: { in: [a.id, b.id] }, status: 'CONFIRMED' },
      }),
    ).toBe(1);
    expect(
      (
        await db.userSubscription.findFirstOrThrow({
          where: { userId: member.userId },
        })
      ).remainingGroupSessions,
    ).toBe(0);
  });
  it('claims exactly one decision when approval and rejection arrive concurrently', async () => {
    const slot = await coaches.createSlot(future(), coach);
    await purchase(members[8], true);
    const booking = await bookings.pt(
      { coachAvailabilityId: slot.id, disciplineId },
      members[8],
    );
    const req = await reviews.request(
      {
        bookingId: booking.id,
        reasonMessage: 'Medical emergency requires a manager decision',
      },
      coach,
    );
    const results = await Promise.allSettled([
      reviews.review(req.id, { action: 'APPROVE' }, manager),
      reviews.review(
        req.id,
        { action: 'REJECT', rejectionReason: 'Covered by another arrangement' },
        receptionist,
      ),
    ]);
    expect(passed(results)).toHaveLength(1);
    const stored = await db.cancellationRequest.findUniqueOrThrow({
      where: { id: req.id },
    });
    const sub = await db.userSubscription.findUniqueOrThrow({
      where: { id: booking.subscriptionId },
    });
    expect(sub.remainingPtSessions).toBe(
      stored.status === 'APPROVED' ? 12 : 11,
    );
  });
  it('creates, edits and deletes manual workouts while protecting author and member access', async () => {
    const service = app.get(WorkoutPlansService),
      exercise = await service.createKnowledge(
        {
          title: 'Stretch',
          category: 'Yoga',
          instructions: 'Stretch slowly with controlled breathing.',
        },
        manager,
      );
    const workout = await service.create(
      {
        memberId: members[0].userId,
        title: 'Personal Yoga',
        exercises: [{ exerciseId: exercise.id, sets: 3, reps: 12 }],
      },
      coach,
    );
    expect(workout.totalExercises).toBe(1);
    expect(
      (await service.list(members[1])).find((plan) => plan.id === workout.id),
    ).toBeUndefined();
    await expect(
      service.update(workout.id, { title: 'Forbidden' }, manager),
    ).rejects.toThrow('FORBIDDEN_RESOURCE');
    await service.update(
      workout.id,
      { exercises: [{ exerciseId: exercise.id, sets: 4 }] },
      coach,
    );
    expect(
      (
        await db.workoutExercise.findFirstOrThrow({
          where: { workoutPlanId: workout.id },
        })
      ).sets,
    ).toBe(4);
    await service.delete(workout.id, coach);
    expect(
      await db.workoutExercise.count({ where: { workoutPlanId: workout.id } }),
    ).toBe(0);
  });
  it('registers only members and protects profile and account administration payloads', async () => {
    const payload = {
      email: 'REGISTERED@Test.Invalid',
      phone: '0777777777',
      password: 'Testing123!',
      fullName: 'Registered Member',
    };
    await api()
      .post('/api/v1/auth/register')
      .send({ ...payload, role: 'ADMIN' })
      .expect(400);
    const registered = await api()
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(201);
    expect(registered.body.data.user.role).toBe('MEMBER');
    expect(registered.body.data.user.passwordHash).toBeUndefined();
    expect(
      await db.memberProfile.count({
        where: { userId: registered.body.data.user.id },
      }),
    ).toBe(1);
    await billing.purchase(
      { memberId: registered.body.data.user.id, planId, ...payment },
      receptionist,
    );
    // An active class package with unused quota allows center entry without a booking.
    await api()
      .post('/api/v1/attendances/gate-checkin')
      .set('Authorization', `Bearer ${tokens.get(receptionist.userId)}`)
      .send({ userId: registered.body.data.user.id })
      .expect(200);
    await api().post('/api/v1/auth/register').send(payload).expect(409);
    const created = await api()
      .post('/api/v1/users/center-managers')
      .set('Authorization', `Bearer ${tokens.get(admin.userId)}`)
      .send({
        email: 'manager-new@test.invalid',
        phone: '0666666666',
        password: 'Testing123!',
        fullName: 'New Manager',
      })
      .expect(201);
    expect(created.body.data.role).toBe('CENTER_MANAGER');
    expect(
      await db.auditLog.count({
        where: { targetId: created.body.data.id, action: 'CREATE_USER' },
      }),
    ).toBe(1);
    const coachToken = tokens.get(coach.userId);
    await api()
      .put('/api/v1/users/profile/me')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ bio: 'Yoga coach biography', yearsExperience: 5 })
      .expect(200);
    await api()
      .put('/api/v1/users/profile/me')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ monthlyEmergencyCancellations: 0 })
      .expect(400);
  });
  it('rolls back booking, quota and events when equipment validation fails', async () => {
    const member = members[12],
      schedule = await newSchedule();
    const before = await db.userSubscription.aggregate({
      where: { userId: member.userId },
      _sum: { remainingGroupSessions: true },
    });
    const notifications: object[] = [],
      unsubscribe = app
        .get(DomainEvents)
        .subscribe((event) => notifications.push(event));
    try {
      await expect(
        bookings.group(
          {
            scheduleId: schedule.id,
            equipmentId: '00000000-0000-4000-8000-000000000001',
          },
          member,
        ),
      ).rejects.toThrow('RESOURCE_NOT_FOUND');
    } finally {
      unsubscribe();
    }
    expect(notifications).toHaveLength(0);
    expect(await db.booking.count({ where: { scheduleId: schedule.id } })).toBe(
      0,
    );
    expect(
      (await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } }))
        .currentEnrolled,
    ).toBe(0);
    const after = await db.userSubscription.aggregate({
      where: { userId: member.userId },
      _sum: { remainingGroupSessions: true },
    });
    expect(after._sum.remainingGroupSessions).toBe(
      before._sum.remainingGroupSessions,
    );
  });
  it('resets monthly DSS counts on demand while preserving lifetime violations', async () => {
    const profile = await db.coachProfile.findUniqueOrThrow({
      where: { userId: coach.userId },
    });
    await db.coachProfile.update({
      where: { id: profile.id },
      data: {
        monthlyEmergencyCancellations: 99,
        lastCancellationResetDate: new Date('2000-01-01'),
      },
    });
    await purchase(members[10], true);
    const slot = await coaches.createSlot(future(), coach),
      booking = await bookings.pt(
        { coachAvailabilityId: slot.id, disciplineId },
        members[10],
      );
    const req = await reviews.request(
      {
        bookingId: booking.id,
        reasonMessage: 'Emergency absence to verify monthly reset policy',
      },
      coach,
    );
    await reviews.review(req.id, { action: 'APPROVE' }, manager);
    const updated = await db.coachProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    expect(updated.monthlyEmergencyCancellations).toBe(1);
    expect(updated.emergencyCancellationCount).toBe(
      profile.emergencyCancellationCount + 1,
    );
  });
  it('fulfills MEMBER mock checkout once, supports add-on/retry, and enforces PT per discipline/day', async () => {
    const member = members[11];
    await login(member);
    const token = tokens.get(member.userId)!;
    const oldPort = process.env.PORT;
    const oldEnabled = process.env.MOCK_PAYMENT_ENABLED;
    const oldSecret = process.env.MOCK_WEBHOOK_SECRET;
    process.env.PORT = new URL(await app.getUrl()).port;
    process.env.MOCK_PAYMENT_ENABLED = 'true';
    process.env.MOCK_WEBHOOK_SECRET =
      'test-mock-webhook-secret-at-least-32-characters';
    try {
      const quote = await api()
        .get(
          `/api/v1/billing/quotations/vip?planId=${vipId}&coachId=${coach.userId}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Number(quote.body.data.totalAmount)).toBe(
        Number(quote.body.data.baseAmount) +
          Number(quote.body.data.ratePerSession) * 12,
      );
      const payload = {
        kind: 'NEW_SUBSCRIPTION',
        planId: vipId,
        coachId: coach.userId,
      };
      const first = await api()
        .post('/api/v1/billing/checkouts')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'member-vip-checkout-1')
        .send(payload)
        .expect(201);
      const orderId = first.body.data.checkoutId as string;
      const paymentId = first.body.data.paymentId as string;
      expect(first.body.data.status).toBe('PENDING_PAYMENT');
      expect(await db.invoice.count({ where: { checkoutId: orderId } })).toBe(
        0,
      );
      await api()
        .post('/api/v1/billing/webhooks/mock')
        .set('x-mock-signature', '0'.repeat(64))
        .send({ eventId: 'forged', paymentId })
        .expect(401);
      const replay = await api()
        .post('/api/v1/billing/checkouts')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'member-vip-checkout-1')
        .send(payload)
        .expect(201);
      expect(replay.body.data.checkoutId).toBe(orderId);
      await api()
        .post('/api/v1/billing/checkouts')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'member-vip-checkout-1')
        .send({ kind: 'NEW_SUBSCRIPTION', planId })
        .expect(409);
      await api()
        .post('/api/v1/dev/mock-payments/lookup')
        .send({ paymentId })
        .expect(201);
      await api()
        .post('/api/v1/dev/mock-payments/simulate')
        .send({ paymentId, outcome: 'SUCCESS' })
        .expect(201);
      await api()
        .post('/api/v1/dev/mock-payments/simulate')
        .send({ paymentId, outcome: 'SUCCESS' })
        .expect(201);
      await api()
        .post('/api/v1/dev/mock-payments/simulate')
        .send({ paymentId, outcome: 'FAILURE' })
        .expect(409);
      const paid = await api()
        .get(`/api/v1/billing/checkouts/${orderId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(paid.body.data.status).toBe('FULFILLED');
      expect(await db.invoice.count({ where: { checkoutId: orderId } })).toBe(
        1,
      );
      const subscriptionId = paid.body.data.subscriptionId as string;
      const addon = await api()
        .post('/api/v1/billing/checkouts')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'member-addon-checkout-1')
        .send({ kind: 'PT_ADDON', subscriptionId, addonSessions: 2 })
        .expect(201);
      await api()
        .post('/api/v1/dev/mock-payments/simulate')
        .send({ paymentId: addon.body.data.paymentId, outcome: 'SUCCESS' })
        .expect(201);
      expect(
        (
          await db.userSubscription.findUniqueOrThrow({
            where: { id: subscriptionId },
          })
        ).remainingPtSessions,
      ).toBe(14);

      const renewal = await api()
        .post('/api/v1/billing/checkouts')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'member-renew-checkout-1')
        .send({ kind: 'RENEWAL', subscriptionId })
        .expect(201);
      await api()
        .post('/api/v1/dev/mock-payments/simulate')
        .send({ paymentId: renewal.body.data.paymentId, outcome: 'FAILURE' })
        .expect(201);
      expect(
        await db.invoice.count({
          where: { checkoutId: renewal.body.data.checkoutId },
        }),
      ).toBe(0);
      const retry = await api()
        .post(`/api/v1/billing/checkouts/${renewal.body.data.checkoutId}/retry`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'member-renew-retry-1')
        .expect(201);
      expect(retry.body.data.paymentId).not.toBe(renewal.body.data.paymentId);
      await api()
        .post('/api/v1/dev/mock-payments/simulate')
        .send({ paymentId: retry.body.data.paymentId, outcome: 'SUCCESS' })
        .expect(201);
      expect(
        await db.invoice.count({
          where: { checkoutId: renewal.body.data.checkoutId },
        }),
      ).toBe(1);

      const freePlan = await app.get(MembershipsService).create(
        {
          name: 'Member Free Trial',
          disciplineId,
          price: 0,
          durationDays: 7,
          packageTier: 'TRIAL',
          trainingMode: 'GROUP_CLASS',
          groupSessionQuota: 3,
          ptSessionQuota: 0,
          unlimitedGymEntry: false,
        },
        manager,
      );
      const free = await api()
        .post('/api/v1/billing/checkouts')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'member-free-trial-1')
        .send({ kind: 'NEW_SUBSCRIPTION', planId: freePlan.id })
        .expect(201);
      expect(free.body.data.status).toBe('FULFILLED');
      expect(free.body.data.paymentId).toBeNull();
      expect(
        (
          await db.invoice.findUniqueOrThrow({
            where: { checkoutId: free.body.data.checkoutId },
          })
        ).paymentMethod,
      ).toBe('FREE');

      const boxing = await db.discipline.create({
        data: { code: 'BOXING', name: 'Boxing' },
      });
      const specialty = await db.specialty.create({
        data: {
          code: 'BOXING_BASIC',
          name: 'Boxing Basic',
          disciplineId: boxing.id,
        },
      });
      const profile = await db.coachProfile.findUniqueOrThrow({
        where: { userId: coach.userId },
      });
      await db.coachSpecialty.create({
        data: { coachProfileId: profile.id, specialtyId: specialty.id },
      });
      const boxingPlan = await app.get(MembershipsService).create(
        {
          name: 'Boxing VIP',
          disciplineId: boxing.id,
          price: 1000000,
          durationDays: 90,
          packageTier: 'VIP',
          trainingMode: 'HYBRID',
          groupSessionQuota: 10,
          ptSessionQuota: 12,
          unlimitedGymEntry: false,
        },
        manager,
      );
      await billing.purchase(
        {
          memberId: member.userId,
          planId: boxingPlan.id,
          coachId: coach.userId,
          ...payment,
        },
        receptionist,
      );
      const day = addDays(localDate(), 20);
      const at = (hour: number) => ({
        startTime: new Date(day.getTime() + (hour - 7) * 3600000).toISOString(),
        endTime: new Date(day.getTime() + (hour - 6) * 3600000).toISOString(),
      });
      const yogaSlot = await coaches.createSlot(at(10), coach);
      const boxingSlot = await coaches.createSlot(at(14), coach);
      const secondYogaSlot = await coaches.createSlot(at(17), coach);
      const yogaBooking = await bookings.pt(
        { coachAvailabilityId: yogaSlot.id, disciplineId },
        member,
      );
      await bookings.pt(
        { coachAvailabilityId: boxingSlot.id, disciplineId: boxing.id },
        member,
      );
      await expect(
        bookings.pt(
          { coachAvailabilityId: secondYogaSlot.id, disciplineId },
          member,
        ),
      ).rejects.toThrow('PT_ALREADY_BOOKED_FOR_DISCIPLINE_DAY');
      const quotaBeforeCancel = (
        await db.userSubscription.findUniqueOrThrow({
          where: { id: yogaBooking.subscriptionId },
        })
      ).remainingPtSessions;
      expect((await bookings.cancel(yogaBooking.id, {}, member)).refunded).toBe(
        true,
      );
      const monday = addDays(localDate(day), -((day.getUTCDay() + 6) % 7))
        .toISOString()
        .slice(0, 10);
      const afterCancel = await api()
        .get(`/api/v1/members/me/calendar?week=${monday}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        afterCancel.body.data.days
          .find(
            (item: { date: string }) =>
              item.date === day.toISOString().slice(0, 10),
          )
          .eligibility.find(
            (item: { subscriptionId: string }) =>
              item.subscriptionId === yogaBooking.subscriptionId,
          ).pt.allowed,
      ).toBe(true);
      const rebooked = await bookings.pt(
        { coachAvailabilityId: secondYogaSlot.id, disciplineId },
        member,
      );
      expect(
        (
          await db.userSubscription.findUniqueOrThrow({
            where: { id: yogaBooking.subscriptionId },
          })
        ).remainingPtSessions,
      ).toBe(quotaBeforeCancel);
      await expect(
        bookings.pt({ coachAvailabilityId: yogaSlot.id, disciplineId }, member),
      ).rejects.toThrow('PT_ALREADY_BOOKED_FOR_DISCIPLINE_DAY');
      expect(
        (await bookings.cancel(rebooked.id, {}, receptionist)).refunded,
      ).toBe(true);
      const rebookedAtDesk = await bookings.pt(
        { coachAvailabilityId: yogaSlot.id, disciplineId },
        member,
      );
      const lateClock = jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date(at(10).startTime).getTime() - 30 * 60000);
      try {
        expect(
          (await bookings.cancel(rebookedAtDesk.id, {}, member)).refunded,
        ).toBe(false);
      } finally {
        lateClock.mockRestore();
      }
      await expect(
        bookings.pt(
          { coachAvailabilityId: secondYogaSlot.id, disciplineId },
          member,
        ),
      ).rejects.toThrow('PT_REBOOK_SAME_CANCELLED_DAY');
      const calendar = await api()
        .get(`/api/v1/members/me/calendar?week=${monday}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        calendar.body.data.bookings.some(
          (booking: { id: string }) => booking.id === yogaBooking.id,
        ),
      ).toBe(true);
      expect(
        calendar.body.data.days
          .find(
            (item: { date: string }) =>
              item.date === day.toISOString().slice(0, 10),
          )
          .eligibility.find(
            (item: { subscriptionId: string }) =>
              item.subscriptionId === yogaBooking.subscriptionId,
          ).pt.reason,
      ).toBe('PT_REBOOK_SAME_CANCELLED_DAY');
      expect(calendar.body.data.timezone).toBe('Asia/Ho_Chi_Minh');
    } finally {
      if (oldPort === undefined) delete process.env.PORT;
      else process.env.PORT = oldPort;
      if (oldEnabled === undefined) delete process.env.MOCK_PAYMENT_ENABLED;
      else process.env.MOCK_PAYMENT_ENABLED = oldEnabled;
      if (oldSecret === undefined) delete process.env.MOCK_WEBHOOK_SECRET;
      else process.env.MOCK_WEBHOOK_SECRET = oldSecret;
    }
  });
});
