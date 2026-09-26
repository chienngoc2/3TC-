import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
export async function isolatedDatabase() {
  const source = process.env.TEST_DATABASE_URL ?? process.env.DIRECT_URL;
  if (!source)
    throw new Error(
      'DIRECT_URL or TEST_DATABASE_URL is required for isolated PostgreSQL tests',
    );
  const schema = `backend_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new PrismaClient({ datasources: { db: { url: source } } });
  const prismaCli = resolve('node_modules/prisma/build/index.js');
  const diff = spawnSync(
    process.execPath,
    [
      prismaCli,
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
    ],
    { encoding: 'utf8', timeout: 60000 },
  );
  if (diff.status !== 0) {
    await admin.$disconnect();
    throw new Error('Prisma schema diff failed');
  }
  const clone = [
    `CREATE SCHEMA "${schema}";`,
    `SET search_path TO "${schema}", public;`,
    diff.stdout,
  ];
  const manual = readFileSync(
    resolve('prisma/migrations/manual/v5_constraints_triggers_rls.sql'),
    'utf8',
  )
    .replace(
      'SET LOCAL search_path TO public;',
      `SET LOCAL search_path TO "${schema}", public;`,
    )
    .replaceAll(
      'WHERE table_name=',
      `WHERE table_schema='${schema}' AND table_name=`,
    );
  const result = spawnSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'db',
      'execute',
      '--stdin',
      '--url',
      source,
    ],
    {
      input: clone.join('\n') + '\n' + manual,
      encoding: 'utf8',
      timeout: 120000,
    },
  );
  if (result.status !== 0) {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
    throw new Error(`Isolated schema setup failed: ${result.stderr}`);
  }
  const target = new URL(source);
  target.searchParams.set('schema', schema);
  target.searchParams.set('connection_limit', '25');
  const prisma = new PrismaClient({
    datasources: { db: { url: target.toString() } },
  });
  await prisma.$connect();
  return {
    prisma,
    schema,
    cleanup: async () => {
      await prisma.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.$disconnect();
    },
  };
}
