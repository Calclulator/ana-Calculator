import { describe, it, expect } from 'vitest';
import { computeVwsFromUv } from '../gfs-vws.js';

describe('computeVwsFromUv', () => {
  it('dzFt=4000 du=8 dv=0 -> 2.0', () => {
    expect(computeVwsFromUv(0, 0, 8, 0, 4000)).toBeCloseTo(2.0, 10);
  });
  it('dzFt=2000 du=8 dv=0 -> 4.0', () => {
    expect(computeVwsFromUv(0, 0, 8, 0, 2000)).toBeCloseTo(4.0, 10);
  });
  it('dzFt=4000 du=0 dv=10 -> 2.5', () => {
    expect(computeVwsFromUv(0, 0, 0, 10, 4000)).toBeCloseTo(2.5, 10);
  });
  it('dzFt=4000 du=6 dv=8 -> 2.5 (10/4)', () => {
    expect(computeVwsFromUv(0, 0, 6, 8, 4000)).toBeCloseTo(2.5, 10);
  });
});
