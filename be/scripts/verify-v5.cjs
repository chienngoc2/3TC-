// Integration checks run only in a temporary schema, never against business tables.
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const root = resolve(__dirname, '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const url = process.env.TEST_DATABASE_URL || process.env.DIRECT_URL;
if (!url) throw new Error('TEST_DATABASE_URL or DIRECT_URL is required.');
const client = () => new PrismaClient({ datasources: { db: { url } } });
const db = client();
const schema = `v5_verify_${randomUUID().replaceAll('-', '')}`;
const manual = readFileSync(resolve(root, 'prisma/migrations/manual/v5_constraints_triggers_rls.sql'), 'utf8').replace(/\r\n/g, '\n');
const sqlReferencePath = existsSync(resolve(root, '../erd/active/database/SQL_v5.md'))
  ? resolve(root, '../erd/active/database/SQL_v5.md')
  : resolve(root, '../erd/SQL_v5.md');
const sqlReference = readFileSync(sqlReferencePath, 'utf8').replace(/\r\n/g, '\n');
const planPath = existsSync(resolve(root, '../erd/implementation_plan.md'))
  ? resolve(root, '../erd/implementation_plan.md')
  : resolve(root, 'markdown/implementation_plan_backend.md');
const plan = existsSync(planPath) ? readFileSync(planPath, 'utf8') : '';
for (const match of plan.matchAll(/```typescript\r?\n([\s\S]*?)```/g)) {
  const block = match[1];
  if (!block.includes('cancelBooking') && !block.includes('reviewCoachCancellationRequest')) continue;
  const source = block.startsWith('async cancelBooking') ? `class Example { ${block} }` : block;
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
}
const name = (table) => `"${schema}".${table}`;
const report = (message) => console.log(`PASS ${message}`);
async function transaction(callback) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`);
    return callback(tx);
  }, { timeout: 20000 });
}
async function race(callbacks) {
  const clients = callbacks.map(client);
  try {
    return await Promise.allSettled(callbacks.map((fn, i) => clients[i].$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`);
      return fn(tx);
    }, { timeout: 20000 })));
  } finally { await Promise.all(clients.map(c => c.$disconnect())); }
}
function ddl(pattern) {
  const match = manual.match(pattern);
  assert(match, `Missing SQL statement: ${pattern}`);
  return match[0];
}
async function main() {
  report('TypeScript syntax of cancellation examples');
  const extensions = await db.$queryRawUnsafe("SELECT extname FROM pg_extension WHERE extname = 'btree_gist'");
  assert.equal(extensions.length, 1, 'btree_gist must already be installed');
  if (!process.env.TEST_DATABASE_URL) {
    const constraints = await db.$queryRawUnsafe(`SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid='public.schedules'::regclass
      AND conname IN ('no_room_schedule_overlap','no_coach_schedule_overlap')`);
    assert.equal(constraints.length, 2);
    for (const constraint of constraints) assert.match(constraint.definition, /WHERE.*OPEN.*FULL/);
    const triggers = await db.$queryRawUnsafe(`SELECT tgname FROM pg_trigger
      WHERE tgrelid='public.schedules'::regclass AND tgname='trg_sync_schedule_capacity_status' AND tgenabled='O'`);
    assert.equal(triggers.length, 1);
    const plans = await db.$queryRawUnsafe(`SELECT price, duration_days, group_session_quota, pt_session_quota
      FROM public.membership_plans WHERE id='00000000-0000-0000-0000-000000000040'::uuid`);
    assert.equal(plans.length, 1);
    assert.equal(Number(plans[0].price), 600000);
    assert.equal(plans[0].duration_days, 30);
    assert.equal(plans[0].group_session_quota, 4);
    assert.equal(plans[0].pt_session_quota, 12);
    report('Installed DB: partial exclusions, capacity trigger, Yoga VIP price/duration/quotas');
  }
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await transaction(async tx => {
    const initial = [
      "CREATE TYPE schedule_status AS ENUM ('OPEN', 'FULL', 'CANCELLED_BY_COACH', 'COMPLETED')",
      `CREATE TABLE schedules (id uuid PRIMARY KEY, room_id uuid NOT NULL, coach_id uuid NOT NULL,
        start_time timestamptz NOT NULL, end_time timestamptz NOT NULL, capacity int NOT NULL,
        current_enrolled int NOT NULL DEFAULT 0, status schedule_status NOT NULL DEFAULT 'OPEN',
        time_range tstzrange GENERATED ALWAYS AS (tstzrange(start_time,end_time,'[)')) STORED,
        CHECK (capacity > 0 AND current_enrolled BETWEEN 0 AND capacity))`,
      `CREATE TABLE coach_availability (id uuid PRIMARY KEY, coach_id uuid NOT NULL,
        start_time timestamptz NOT NULL, end_time timestamptz NOT NULL,
        is_emergency_cancelled boolean NOT NULL DEFAULT false,
        time_range tstzrange GENERATED ALWAYS AS (tstzrange(start_time,end_time,'[)')) STORED)`,
      "CREATE TABLE cancellation_requests (id uuid PRIMARY KEY, status text NOT NULL DEFAULT 'PENDING')",
      "CREATE TABLE user_subscriptions (id uuid PRIMARY KEY, remaining_pt_sessions int NOT NULL DEFAULT 0)",
      "CREATE TABLE bookings (id uuid PRIMARY KEY, subscription_id uuid NOT NULL, status text NOT NULL DEFAULT 'CONFIRMED')",
    ];
    for (const s of initial) await tx.$executeRawUnsafe(s);
    for (const constraint of ['no_room_schedule_overlap', 'no_coach_schedule_overlap']) {
      const statement = ddl(new RegExp(`ALTER TABLE schedules ADD CONSTRAINT ${constraint}[\\s\\S]*?;`));
      assert(sqlReference.includes(statement.replace(`ALTER TABLE schedules ADD CONSTRAINT ${constraint}`, `CONSTRAINT ${constraint}`).replace(/;$/, '').replace(/\s+/g, ' ')) ||
        new RegExp(`CONSTRAINT ${constraint}[^\\n]+WHERE`).test(sqlReference));
      await tx.$executeRawUnsafe(statement);
    }
    for (const fn of [
      'fn_sync_schedule_capacity_status',
      'fn_prevent_schedule_capacity_underflow',
      'fn_prevent_coach_cross_schedule_conflict',
    ]) {
      const statement = ddl(new RegExp(`CREATE OR REPLACE FUNCTION ${fn}\\(\\)[\\s\\S]*?\\$\\$ LANGUAGE plpgsql;`));
      assert(sqlReference.includes(statement), `${fn} differs between migration and reference`);
      await tx.$executeRawUnsafe(statement);
    }
    for (const trigger of [
      'trg_sync_schedule_capacity_status',
      'trg_prevent_schedule_capacity_underflow',
      'trg_check_coach_avail_overlap',
      'trg_check_schedule_coach_overlap',
    ]) {
      await tx.$executeRawUnsafe(ddl(new RegExp(`CREATE TRIGGER ${trigger}[\\s\\S]*?;`)));
    }
  });
  const room = randomUUID(), coach = randomUUID(), otherCoach = randomUUID();
  const insertSchedule = (id, r, c, from = '2030-01-01T09:00:00Z', to = '2030-01-01T10:00:00Z') =>
    `INSERT INTO schedules(id,room_id,coach_id,start_time,end_time,capacity) VALUES ('${id}','${r}','${c}','${from}','${to}',1)`;
  const first = randomUUID(), second = randomUUID();
  let outcomes = await race([
    tx => tx.$executeRawUnsafe(insertSchedule(first, room, coach)),
    tx => tx.$executeRawUnsafe(insertSchedule(second, room, otherCoach)),
  ]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.match(JSON.stringify(outcomes.filter(x => x.status === 'rejected').map(x => x.reason.meta)), /23P01|40P01|exclusion|deadlock/i);
  report('Concurrent schedules: same room, different coaches => exactly one succeeds');
  const [{ id: winner }] = await db.$queryRawUnsafe(`SELECT id FROM ${name('schedules')}`);
  await transaction(tx => tx.$executeRawUnsafe(`UPDATE schedules SET current_enrolled=1 WHERE id='${winner}'`));
  let [row] = await db.$queryRawUnsafe(`SELECT status::text FROM ${name('schedules')} WHERE id='${winner}'`);
  assert.equal(row.status, 'FULL');
  await transaction(tx => tx.$executeRawUnsafe(`UPDATE schedules SET current_enrolled=0 WHERE id='${winner}'`));
  [row] = await db.$queryRawUnsafe(`SELECT status::text FROM ${name('schedules')} WHERE id='${winner}'`);
  assert.equal(row.status, 'OPEN');
  await transaction(tx => tx.$executeRawUnsafe(`UPDATE schedules SET status='CANCELLED_BY_COACH',current_enrolled=0 WHERE id='${winner}'`));
  await transaction(tx => tx.$executeRawUnsafe(insertSchedule(randomUUID(), room, coach)));
  report('OPEN/FULL transition, cancelled schedule releases room/coach and retains history');
  await transaction(tx => tx.$executeRawUnsafe(`UPDATE schedules SET status='COMPLETED',current_enrolled=1 WHERE id='${winner}'`));
  [row] = await db.$queryRawUnsafe(`SELECT status::text FROM ${name('schedules')} WHERE id='${winner}'`);
  assert.equal(row.status, 'COMPLETED');
  report('Capacity changes preserve terminal schedule status');
  const testSchedId = randomUUID();
  await transaction(tx => tx.$executeRawUnsafe(insertSchedule(testSchedId, randomUUID(), randomUUID())));
  await transaction(tx => tx.$executeRawUnsafe(`UPDATE schedules SET current_enrolled=3, capacity=5 WHERE id='${testSchedId}'`));
  await assert.rejects(
    transaction(tx => tx.$executeRawUnsafe(`UPDATE schedules SET capacity=2 WHERE id='${testSchedId}'`)),
    /CANNOT_REDUCE_CAPACITY_BELOW_CURRENT_ENROLLED/i,
  );
  report('Capacity reduction below current_enrolled is blocked by trigger');
  const occupiedCoach = randomUUID();
  outcomes = await race([
    tx => tx.$executeRawUnsafe(insertSchedule(randomUUID(), randomUUID(), occupiedCoach)),
    tx => tx.$executeRawUnsafe(insertSchedule(randomUUID(), randomUUID(), occupiedCoach)),
  ]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  report('Concurrent schedules: same coach, different rooms => exactly one succeeds');
  const inactiveSlot = randomUUID();
  await transaction(tx => tx.$executeRawUnsafe(`INSERT INTO coach_availability(id,coach_id,start_time,end_time,is_emergency_cancelled) VALUES ('${inactiveSlot}','${coach}','2030-01-01T09:00:00Z','2030-01-01T10:00:00Z',true)`));
  await assert.rejects(transaction(tx => tx.$executeRawUnsafe(`UPDATE coach_availability SET is_emergency_cancelled=false WHERE id='${inactiveSlot}'`)));
  report('Reactivating an emergency-cancelled slot checks group schedule conflicts');
  const crossCoach = randomUUID();
  outcomes = await race([
    tx => tx.$executeRawUnsafe(insertSchedule(randomUUID(), randomUUID(), crossCoach)),
    tx => tx.$executeRawUnsafe(`INSERT INTO coach_availability(id,coach_id,start_time,end_time) VALUES ('${randomUUID()}','${crossCoach}','2030-01-01T09:00:00Z','2030-01-01T10:00:00Z')`),
  ]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  report('Concurrent group/PT schedule for same coach => exactly one succeeds');
  const req = randomUUID(), sub = randomUUID(), booking = randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO ${name('cancellation_requests')}(id) VALUES ('${req}')`);
  await db.$executeRawUnsafe(`INSERT INTO ${name('user_subscriptions')}(id) VALUES ('${sub}')`);
  await db.$executeRawUnsafe(`INSERT INTO ${name('bookings')}(id,subscription_id) VALUES ('${booking}','${sub}')`);
  const approve = async tx => {
    const count = await tx.$executeRawUnsafe(`UPDATE cancellation_requests SET status='APPROVED' WHERE id='${req}' AND status='PENDING'`);
    if (count !== 1) return false;
    const cancelled = await tx.$executeRawUnsafe(`UPDATE bookings SET status='CANCELLED' WHERE id='${booking}' AND status IN ('CONFIRMED','PENDING')`);
    if (cancelled === 1) await tx.$executeRawUnsafe(`UPDATE user_subscriptions SET remaining_pt_sessions=remaining_pt_sessions+1 WHERE id='${sub}'`);
    return true;
  };
  outcomes = await race([approve, approve]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled' && x.value === true).length, 1);
  [row] = await db.$queryRawUnsafe(`SELECT remaining_pt_sessions FROM ${name('user_subscriptions')} WHERE id='${sub}'`);
  assert.equal(row.remaining_pt_sessions, 1);
  report('Two reviewers => one claim and exactly one quota refund');
  const req2 = randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO ${name('cancellation_requests')}(id) VALUES ('${req2}')`);
  outcomes = await race(['APPROVED','REJECTED'].map(status => tx => tx.$executeRawUnsafe(`UPDATE cancellation_requests SET status='${status}' WHERE id='${req2}' AND status='PENDING'`)));
  assert.equal(outcomes.filter(x => x.status === 'fulfilled' && x.value === 1).length, 1);
  report('APPROVE/REJECT race => exactly one final decision');
  const req3 = randomUUID(), booking2 = randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO ${name('cancellation_requests')}(id) VALUES ('${req3}')`);
  await db.$executeRawUnsafe(`INSERT INTO ${name('bookings')}(id,subscription_id) VALUES ('${booking2}','${sub}')`);
  const cancel = async tx => {
    const count = await tx.$executeRawUnsafe(`UPDATE bookings SET status='CANCELLED' WHERE id='${booking2}' AND status='CONFIRMED'`);
    if (count === 1) await tx.$executeRawUnsafe(`UPDATE user_subscriptions SET remaining_pt_sessions=remaining_pt_sessions+1 WHERE id='${sub}'`);
    return count;
  };
  outcomes = await race([cancel, async tx => {
    const count = await tx.$executeRawUnsafe(`UPDATE cancellation_requests SET status='APPROVED' WHERE id='${req3}' AND status='PENDING'`);
    assert.equal(count, 1);
    return cancel(tx);
  }]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled' && x.value === 1).length, 1);
  [row] = await db.$queryRawUnsafe(`SELECT remaining_pt_sessions FROM ${name('user_subscriptions')} WHERE id='${sub}'`);
  assert.equal(row.remaining_pt_sessions, 2);
  report('Member cancellation vs coach approval => no duplicate quota refund');
}
main().catch(error => {
  console.error('V5 verification failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  // Name is generated locally; no user-supplied schema or business table is dropped.
  assert(/^v5_verify_[a-f0-9]{32}$/.test(schema));
  try { await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
  finally { await db.$disconnect(); }
});
