import { describe, it, expect } from 'vitest';
import {
  computeFdpLimit,
  formatDurationMin,
  formatWallClockMin
} from '../js/fdp-calc.js';

describe('computeFdpLimit sample cases', function () {
  it('case 1: single 09:00 sector 1', function () {
    var r = computeFdpLimit({
      suHour: 9, suMin: 0, sectors: 1, crew: 'single',
      restClass: 1, fltMin: 600, taxiOutMin: 15, taxiInMin: 10
    });
    expect(formatDurationMin(r.maxFdpMin)).toBe('13:00');
    expect(formatDurationMin(r.maxBlkMin)).toBe('10:00');
    expect(formatWallClockMin(r.latestBlockInMin)).toBe('22:00');
    expect(formatWallClockMin(r.latestTakeoffMin)).toBe('11:50');
    expect(formatWallClockMin(r.latestBlockOutMin)).toBe('11:35');
  });

  it('case 2: multi 22:00 class 1', function () {
    var r = computeFdpLimit({
      suHour: 22, suMin: 0, sectors: 1, crew: 'multi',
      restClass: 1, fltMin: 720, taxiOutMin: 15, taxiInMin: 15
    });
    expect(formatDurationMin(r.maxFdpMin)).toBe('17:00');
    expect(formatDurationMin(r.maxBlkMin)).toBe('15:00');
    expect(formatWallClockMin(r.latestBlockInMin)).toBe('15:00 (+1)');
    expect(formatWallClockMin(r.latestTakeoffMin)).toBe('02:45 (+1)');
    expect(formatWallClockMin(r.latestBlockOutMin)).toBe('02:30 (+1)');
  });

  it('case 3: double 14:30 3 sectors class 2', function () {
    var r = computeFdpLimit({
      suHour: 14, suMin: 30, sectors: 3, crew: 'double',
      restClass: 2, fltMin: 960, taxiOutMin: 20, taxiInMin: 15
    });
    expect(formatDurationMin(r.maxFdpMin)).toBe('16:00');
    expect(formatDurationMin(r.maxBlkMin)).toBe('16:00');
    expect(formatWallClockMin(r.latestBlockInMin)).toBe('06:30 (+1)');
    expect(formatWallClockMin(r.latestTakeoffMin)).toBe('14:15');
    expect(formatWallClockMin(r.latestBlockOutMin)).toBe('13:55');
  });
});

describe('multi class 2/3 block downgrade', function () {
  it('multi class 2 block is 12h59m', function () {
    var r = computeFdpLimit({
      suHour: 10, suMin: 0, sectors: 1, crew: 'multi', restClass: 2,
      fltMin: null, taxiOutMin: 15, taxiInMin: 10
    });
    expect(r.maxBlkMin).toBe(779);
    expect(formatDurationMin(r.maxBlkMin)).toBe('12:59');
  });
});
