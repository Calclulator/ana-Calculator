import { describe, it, expect } from 'vitest';
import { computeVwsFromUv } from '../gfs-vws.js';

describe('computeVwsFromUv', () => {
  it('dzFt=4000 kt delta 8 horizontal gives 2.0', () => {
    expect(computeVwsFromUv(0, 0, 8, 0, 4000)).toBeCloseTo(2.0, 10);
  });
  it('dzFt=2000 same wind delta gives 4.0 (legacy +/-1000ft scale)', () => {
    expect(computeVwsFromUv(0, 0, 8, 0, 2000)).toBeCloseTo(4.0, 10);
  });
  it('zero shear gives 0', () => {
    expect(computeVwsFromUv(5, 3, 5, 3, 4000)).toBe(0);
  });
});
