import { describe, it, expect } from 'vitest';
import {
  computeVwsFromUv,
  wscpVwsUiBucketFromKtPerKft,
  wscpVwsBandLabelFromKtPerKft,
  WSCP_VWS_THRESHOLDS_SI,
  WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT
} from '../gfs-vws.js';

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

describe('ANA WSCP VWS bands (shared GFS overlay + UI)', () => {
  function bucketSi(vSi) {
    var thr = WSCP_VWS_THRESHOLDS_SI;
    var i;
    for (i = 0; i < thr.length; i++) {
      if (vSi >= thr[i]) return i;
    }
    return thr.length;
  }

  it('kt 9 -> UI L (green band index 2)', () => {
    expect(wscpVwsUiBucketFromKtPerKft(9)).toBe(2);
    expect(wscpVwsBandLabelFromKtPerKft(9)).toBe('L (7-9)');
  });

  it('kt 14 -> UI MOD', () => {
    expect(wscpVwsUiBucketFromKtPerKft(14)).toBe(4);
    expect(wscpVwsBandLabelFromKtPerKft(14)).toContain('MOD');
  });

  it('kt 13 -> MOD not SEV (radar SI bucket)', () => {
    var vSi = 13 / WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT;
    expect(bucketSi(vSi)).toBe(1);
    expect(wscpVwsBandLabelFromKtPerKft(13)).toContain('MOD');
  });

  it('SI threshold aligns with 18 kt Severe boundary', () => {
    var vLo = (18 - 1e-6) / WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT;
    var vHi = (18 + 1e-6) / WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT;
    expect(bucketSi(vLo)).toBeGreaterThan(0);
    expect(bucketSi(vHi)).toBe(0);
  });
});
