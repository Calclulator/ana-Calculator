import { describe, it, expect } from 'vitest';
import { gfsRadarNeighborPt } from '../geo-helpers.js';

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
