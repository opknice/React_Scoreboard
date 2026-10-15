import { describe, expect, it } from 'vitest';
import { FREE_TRIAL_DAYS } from '../utils/trialAccess';
import { ACCESS_PLAN_FEATURE_GROUPS, ACCESS_PLAN_SUMMARIES } from './accessPlans';

describe('access plan trial duration', () => {
  it('shows the configured free-trial duration in every plan comparison', () => {
    const expectedDuration = `${FREE_TRIAL_DAYS} วัน`;
    const trialSummary = ACCESS_PLAN_SUMMARIES.find((plan) => plan.id === 'trial');
    const durationFeature = ACCESS_PLAN_FEATURE_GROUPS
      .flatMap((group) => group.features)
      .find((feature) => feature.label === 'ระยะเวลาการใช้งาน');

    expect(trialSummary?.duration).toBe(expectedDuration);
    expect(durationFeature?.trial).toBe(expectedDuration);
  });
});
