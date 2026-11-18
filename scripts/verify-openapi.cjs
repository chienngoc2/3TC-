const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
// Metadata verification boots the compiled application with dependency stubs.
process.env.DATABASE_URL ||=
  'postgresql://metadata:metadata@localhost:5432/metadata';
process.env.JWT_ACCESS_SECRET ||= 'metadata-verification-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'metadata-verification-refresh-secret';
const { Test } = require('@nestjs/testing');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma.service');
const { configureApp } = require('../dist/config/configure-app');
async function main() {
  const fixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  const app = fixture.createNestApplication();
  try {
    configureApp(app);
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Sports Center V5')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    const paths = document.paths;
    for (const [path, method] of [
      ['/api/v1/bookings/group-class', 'post'],
      ['/api/v1/billing/subscriptions/vip', 'post'],
      ['/api/v1/attendances/gate-checkin', 'post'],
      ['/api/v1/attendances/class-checkin/{id}', 'put'],
      ['/api/v1/coaches/cancellation-requests', 'post'],
      ['/api/v1/workout-plans', 'post'],
      ['/api/v1/coaches/availability/bulk', 'post'],
      ['/api/v1/staff-shifts/bulk', 'post'],
      ['/api/v1/workout-plans/recommendations/{memberId}', 'get'],
    ])
      assert(paths[path]?.[method], `Missing contract: ${method} ${path}`);
    for (const [schema, property] of [
      ['PlanDto', 'price'],
      ['VipPurchaseDto', 'userId'],
      ['GateCheckinDto', 'preferredZone'],
      ['WorkoutDto', 'exercises'],
      ['ReviewDto', 'action'],
    ]) {
      assert(
        document.components.schemas[schema]?.properties?.[property],
        `Missing Swagger field: ${schema}.${property}`,
      );
    }
    const destination = resolve('.tmp/backend-openapi.json');
    mkdirSync(resolve('.tmp'), { recursive: true });
    writeFileSync(destination, JSON.stringify(document, null, 2));
    const count = Object.values(paths).reduce(
      (total, path) =>
        total +
        Object.keys(path).filter((method) =>
          ['get', 'post', 'put', 'delete', 'patch'].includes(method),
        ).length,
      0,
    );
    console.log(
      `PASS compiled application wiring, ${count} HTTP endpoints, DTO schemas and canonical API contracts`,
    );
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
