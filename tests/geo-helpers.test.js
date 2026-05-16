import { describe, it, expect } from 'vitest';
import { gfsRadarNeighborPt, normalizePoint, normalizeLon, floorUtcHour, wpValidUtcHour } from '../geo-helpers.js';

describe('normalizePoint', () => {
  it('passes through { lat, lon }', () => {
    const r = normalizePoint({ lat: 35, lon: 140 });
    expect(r).toEqual({ lat: 35, lon: 140 });
  });

  it('maps lng to lon (Leaflet style)', () => {
    const r = normalizePoint({ lat: -2, lng: 100.5 });
    expect(r).toEqual({ lat: -2, lon: 100.5 });
  });

  it('maps lngU to lon when lon and lng are absent', () => {
    const r = normalizePoint({ lat: 10, lngU: -175.25 });
    expect(r).toEqual({ lat: 10, lon: -175.25 });
  });

  it('normalizes JetPlan-style coord WP id row (lat/lng only)', () => {
    const r = normalizePoint({ id: '43E70', lat: 43.11666666666667, lng: -170.11666666666666 });
    expect(r).not.toBeNull();
    expect(r.lon).toBeCloseTo(-170.11666666666666, 8);
    expect(r.lat).toBeCloseTo(43.11666666666667, 8);
  });

  it('returns null when only lat is present', () => {
    expect(normalizePoint({ lat: 35 })).toBeNull();
  });

  it('returns null when only lng is present', () => {
    expect(normalizePoint({ lng: 140 })).toBeNull();
  });

  it('returns null for null or undefined', () => {
    expect(normalizePoint(null)).toBeNull();
    expect(normalizePoint(undefined)).toBeNull();
  });

  it('returns null for non-numeric coordinates', () => {
    expect(normalizePoint({ lat: '35', lon: 140 })).toBeNull();
    expect(normalizePoint({ lat: 35, lon: '140' })).toBeNull();
    expect(normalizePoint({ lat: 35, lng: '140' })).toBeNull();
  });

  it('returns null when lon or lat is NaN', () => {
    expect(normalizePoint({ lat: NaN, lon: 0 })).toBeNull();
    expect(normalizePoint({ lat: 0, lon: NaN })).toBeNull();
    expect(normalizePoint({ lat: 0, lng: NaN })).toBeNull();
  });

  it('normalizes longitude past dateline on point', () => {
    const r = normalizePoint({ lat: 43, lon: 184.5 });
    expect(r).not.toBeNull();
    expect(r.lon).toBeCloseTo(-175.5, 3);
  });
});

describe('normalizeLon', () => {
  it('maps 184.557 to -175.443', () => {
    expect(normalizeLon(184.557)).toBeCloseTo(-175.443, 3);
  });
  it('maps 200 to -160', () => {
    expect(normalizeLon(200)).toBeCloseTo(-160, 6);
  });
  it('maps -200 to 160', () => {
    expect(normalizeLon(-200)).toBeCloseTo(160, 6);
  });
  it('maps 180 to -180', () => {
    expect(normalizeLon(180)).toBeCloseTo(-180, 6);
  });
  it('maps -180 to -180', () => {
    expect(normalizeLon(-180)).toBeCloseTo(-180, 6);
  });
  it('maps 0 to 0', () => {
    expect(normalizeLon(0)).toBe(0);
  });
  it('returns NaN for NaN', () => {
    expect(Number.isNaN(normalizeLon(NaN))).toBe(true);
  });
});

describe('floorUtcHour', () => {
  it('floors 2026-05-09T10:00:00Z to hour boundary', () => {
    const r = floorUtcHour(new Date(Date.UTC(2026, 4, 9, 10, 0, 0, 0)));
    expect(r.toISOString()).toBe('2026-05-09T10:00:00.000Z');
  });
  it('floors 2026-05-09T10:00:01Z to 10:00Z', () => {
    const r = floorUtcHour(new Date(Date.UTC(2026, 4, 9, 10, 0, 1, 0)));
    expect(r.toISOString()).toBe('2026-05-09T10:00:00.000Z');
  });
  it('floors 2026-05-09T10:59:59Z to 10:00Z', () => {
    const r = floorUtcHour(new Date(Date.UTC(2026, 4, 9, 10, 59, 59, 999)));
    expect(r.toISOString()).toBe('2026-05-09T10:00:00.000Z');
  });
  it('keeps 2026-05-09T11:00:00Z at 11:00Z', () => {
    const r = floorUtcHour(new Date(Date.UTC(2026, 4, 9, 11, 0, 0, 0)));
    expect(r.toISOString()).toBe('2026-05-09T11:00:00.000Z');
  });
  it('uses UTC fields only (not local TZ)', () => {
    const r = floorUtcHour(new Date('2026-05-09T10:42:33.000Z'));
    expect(r.toISOString()).toBe('2026-05-09T10:00:00.000Z');
  });
});

describe('wpValidUtcHour', () => {
  it('prefers wp.etoUtc when it is a valid Date', () => {
    const eto = new Date(Date.UTC(2026, 4, 9, 10, 42, 0, 0));
    const fb = new Date(Date.UTC(2026, 4, 9, 15, 0, 0, 0));
    const r = wpValidUtcHour({ etoUtc: eto }, fb);
    expect(r.toISOString()).toBe('2026-05-09T10:00:00.000Z');
  });
  it('uses floored fallback when etoUtc is absent', () => {
    const fb = new Date(Date.UTC(2026, 4, 9, 10, 15, 30, 500));
    const r = wpValidUtcHour({}, fb);
    expect(r.toISOString()).toBe('2026-05-09T10:00:00.000Z');
  });
  it('uses floored new Date when wp has no etoUtc and fallback is null', () => {
    const r = wpValidUtcHour(null, null);
    expect(r.getUTCMinutes()).toBe(0);
    expect(r.getUTCSeconds()).toBe(0);
    expect(r.getUTCMilliseconds()).toBe(0);
  });
});

describe('gfsRadarNeighborPt', () => {
  const base = { lat: 35, lon: 140 };

  it('handles N direction', () => {
    const r = gfsRadarNeighborPt(base, 'N', 60);
    expect(r.lat).toBeCloseTo(36, 5);
    expect(r.lon).toBeCloseTo(140, 5);
  });

  it('handles S direction', () => {
    const r = gfsRadarNeighborPt(base, 'S', 60);
    expect(r.lat).toBeCloseTo(34, 5);
  });

  it('handles E direction with cos(lat) correction', () => {
    const r = gfsRadarNeighborPt(base, 'E', 60);
    expect(r.lat).toBeCloseTo(35, 5);
    expect(r.lon).toBeGreaterThan(140);
    expect(r.lon).toBeCloseTo(140 + 1 / Math.cos(35 * Math.PI / 180), 4);
  });

  it('handles W direction', () => {
    const r = gfsRadarNeighborPt(base, 'W', 60);
    expect(r.lon).toBeLessThan(140);
  });

  // Regression test: Leaflet-style { lat, lng } input should also work
  it('falls back to lng when lon is missing (Leaflet style)', () => {
    const wp = { lat: 35, lng: 140 };
    const r = gfsRadarNeighborPt(wp, 'E', 60);
    expect(r.lat).toBeCloseTo(35, 5);
    expect(typeof r.lon).toBe('number');
    expect(isNaN(r.lon)).toBe(false);
    expect(r.lon).toBeGreaterThan(140);
  });

  it('does not produce NaN or undefined for { lat, lng } input in any direction', () => {
    const wp = { lat: 35, lng: 140 };
    ['N', 'S', 'E', 'W'].forEach((dir) => {
      const r = gfsRadarNeighborPt(wp, dir, 60);
      expect(isNaN(r.lat)).toBe(false);
      expect(isNaN(r.lon)).toBe(false);
      expect(r.lon).not.toBeUndefined();
    });
  });

  it('handles equator (cos(lat) ~ 1) correctly', () => {
    const r = gfsRadarNeighborPt({ lat: 0, lon: 0 }, 'E', 60);
    expect(r.lon).toBeCloseTo(1, 5);
  });

  it('does not divide by zero near poles', () => {
    const r = gfsRadarNeighborPt({ lat: 89.9999, lon: 0 }, 'E', 60);
    expect(isFinite(r.lon)).toBe(true);
  });
});
