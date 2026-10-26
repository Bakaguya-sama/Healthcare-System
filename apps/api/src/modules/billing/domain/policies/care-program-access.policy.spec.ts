import { decideCareProgramAccess } from './care-program-access.policy';

describe('care program subscription access policy', () => {
  const snapshot = {
    code: 'FREE',
    version: 1,
    name: 'Free',
    activeCareProgramLimit: 1,
  };

  it('uses the immutable snapshot limit, not the plan code', () => {
    expect(decideCareProgramAccess(snapshot, 0)).toEqual({
      eligible: true,
      activeCareProgramLimit: 1,
    });
    expect(
      decideCareProgramAccess({ ...snapshot, code: 'UNRECOGNIZED' }, 1),
    ).toEqual({
      eligible: false,
      reasonCode: 'active_care_program_limit_reached',
    });
  });

  it('fails closed for malformed snapshots and counts', () => {
    expect(decideCareProgramAccess({}, 0)).toEqual({
      eligible: false,
      reasonCode: 'subscription_snapshot_invalid',
    });
    expect(decideCareProgramAccess(snapshot, -1)).toEqual({
      eligible: false,
      reasonCode: 'active_program_count_invalid',
    });
  });
});
