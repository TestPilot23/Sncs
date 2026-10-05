import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { deployCommands, planUploads } from './lib/deploy-plan.ts';

const bucket = process.env.SITE_BUCKET;
const distributionId = process.env.DISTRIBUTION_ID;
if (!bucket || !distributionId) {
  console.error('deploy: SITE_BUCKET and DISTRIBUTION_ID are required');
  process.exit(2);
}

const keys = readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => `${e.parentPath}/${e.name}`.replace(/^dist\//, ''));

for (const args of deployCommands(planUploads(keys), bucket, distributionId)) {
  console.log(`aws ${args.slice(0, 2).join(' ')} ${args[3]?.startsWith('s3://') ? args[3] : ''}`);
  execFileSync('aws', args, { stdio: 'inherit' });
}
