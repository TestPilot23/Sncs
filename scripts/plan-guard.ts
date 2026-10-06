import { readFileSync } from 'node:fs';
import { checkPlan } from './lib/plan-guard.ts';

const file = process.argv[2];
if (!file) {
  console.error(
    'usage: node scripts/plan-guard.ts <plan.json>   (terraform show -json <planfile>)',
  );
  process.exit(2);
}

const result = checkPlan(JSON.parse(readFileSync(file, 'utf8')));
for (const v of result.violations) console.error(`plan-guard: ${v.kind}: ${v.address}`);
if (!result.ok) {
  console.error(
    'plan-guard: refusing. Destroys and replaces are done by an operator, not the pipeline.',
  );
  process.exit(1);
}
console.log('plan-guard: ok (no destroys or replaces)');
