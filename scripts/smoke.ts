import { runSmoke } from './lib/smoke.ts';

const base = process.argv[2] ?? process.env.SMOKE_URL;
if (!base) {
  console.error('usage: node scripts/smoke.ts <https://host>   (or SMOKE_URL)');
  process.exit(2);
}

const result = await runSmoke(base);
for (const f of result.failures) console.error(`smoke: FAIL ${f.check}: ${f.detail}`);
if (!result.ok) process.exit(1);
console.log(`smoke: ok (${base})`);
