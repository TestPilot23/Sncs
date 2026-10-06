export type Violation = { address: string; kind: 'destroy' | 'replace' | 'malformed' };
export type GuardResult = { ok: boolean; violations: Violation[] };

const malformed = (address: string): GuardResult => ({
  ok: false,
  violations: [{ address, kind: 'malformed' }],
});

/** Reads `terraform show -json` output. Anything we cannot read counts as a failure. */
export function checkPlan(plan: unknown): GuardResult {
  const changes = (plan as { resource_changes?: unknown } | null)?.resource_changes;
  if (!Array.isArray(changes)) return malformed('(plan)');

  const violations: Violation[] = [];
  for (const rc of changes as { address?: string; change?: { actions?: unknown } }[]) {
    const address = rc?.address ?? '(unknown)';
    const actions = rc?.change?.actions;
    if (!Array.isArray(actions)) {
      violations.push({ address, kind: 'malformed' });
    } else if (actions.includes('delete')) {
      violations.push({ address, kind: actions.length > 1 ? 'replace' : 'destroy' });
    }
  }
  return { ok: violations.length === 0, violations };
}
