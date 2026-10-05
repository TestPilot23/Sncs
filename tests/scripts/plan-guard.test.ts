import { describe, expect, it } from 'vitest';
import { checkPlan } from '../../scripts/lib/plan-guard.ts';

const change = (address: string, actions: string[]) => ({ address, change: { actions } });
const plan = (...rcs: ReturnType<typeof change>[]) => ({
  format_version: '1.2',
  resource_changes: rcs,
});

describe('plan guard', () => {
  it('passes a plan that only creates, updates, reads or leaves resources alone', () => {
    const result = checkPlan(
      plan(
        change('aws_s3_bucket.site', ['no-op']),
        change('aws_lambda_function.contact', ['update']),
        change('aws_sns_topic.alerts', ['create']),
        change('data.aws_caller_identity.me', ['read']),
      ),
    );
    expect(result).toEqual({ ok: true, violations: [] });
  });

  it('passes an empty plan', () => {
    expect(checkPlan(plan())).toEqual({ ok: true, violations: [] });
  });

  it('fails a plan that destroys a resource and names it', () => {
    const result = checkPlan(plan(change('aws_s3_bucket.site', ['delete'])));
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ address: 'aws_s3_bucket.site', kind: 'destroy' }]);
  });

  it('fails a replace in either order (create-before-destroy or destroy-before-create)', () => {
    const result = checkPlan(
      plan(
        change('aws_cloudfront_distribution.site', ['delete', 'create']),
        change('aws_acm_certificate.site', ['create', 'delete']),
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { address: 'aws_cloudfront_distribution.site', kind: 'replace' },
      { address: 'aws_acm_certificate.site', kind: 'replace' },
    ]);
  });

  it('reports every violation, not just the first, and still lets safe changes through', () => {
    const result = checkPlan(
      plan(
        change('aws_a.x', ['create']),
        change('aws_b.y', ['delete']),
        change('aws_c.z', ['delete', 'create']),
      ),
    );
    expect(result.violations.map((v) => v.address)).toEqual(['aws_b.y', 'aws_c.z']);
  });

  it.each([
    ['null', null],
    ['a string', 'plan'],
    ['an object without resource_changes', { format_version: '1.2' }],
    ['resource_changes that is not a list', { resource_changes: {} }],
  ])('fails closed on malformed input: %s', (_name, input) => {
    const result = checkPlan(input);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ address: '(plan)', kind: 'malformed' }]);
  });

  it('fails closed on a change entry without actions', () => {
    const result = checkPlan({ resource_changes: [{ address: 'aws_x.y', change: {} }] });
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ address: 'aws_x.y', kind: 'malformed' }]);
  });
});
