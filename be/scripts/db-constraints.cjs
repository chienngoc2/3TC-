const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
if (!process.env.DIRECT_URL) {
  console.error('DIRECT_URL is required to apply V5 SQL through a direct database connection.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [
  require.resolve('prisma/build/index.js'), 'db', 'execute',
  '--schema', resolve(root, 'prisma/schema.prisma'),
  '--file', resolve(root, 'prisma/migrations/manual/v5_constraints_triggers_rls.sql'),
], {
  cwd: root,
  env: { ...process.env, DATABASE_URL: process.env.DIRECT_URL },
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
