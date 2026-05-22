import { describe, it, expect } from 'vitest';
import {
  computeFdpLimit,
  formatDurationMin,
  formatWallClockMin,
  parseTimeInput,
  parseNavlogFdpFields
} from '../js/fdp-calc.js';

describe('parseTimeInput', function () {
  it('accepts HHMM and HH:MM variants', function () {
    expect(parseTimeInput('0930')).toEqual({ hour: 9, min: 30 });
    expect(parseTimeInput('09:30')).toEqual({ hour: 9, min: 30 });
    expect(parseTimeInput('930')).toEqual({ hour: 9, min: 30 });
    expect(parseTimeInput('9')).toEqual({ hour: 9, min: 0 });
    expect(parseTimeInput('1430')).toEqual({ hour: 14, min: 30 });
  });

  it('rejects invalid values', function () {
    expect(parseTimeInput('25:00')).toBeNull();
    expect(parseTimeInput('09:65')).toBeNull();
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('30')).toBeNull();
  });
});

describe('parseNavlogFdpFields', function () {
  it('extracts FLT time and taxi minutes from summary patterns', function () {
    var txt = 'NML PLAN                                B/T 09HR35MIN F/T 08HR49MIN\n' +
      'T/O TAXI 15  T/I TAXI 10';
    var r = parseNavlogFdpFields(txt);
    expect(r.fltMin).toBe(8 * 60 + 49);
    expect(r.taxiOutMin).toBe(15);
    expect(r.taxiInMin).toBe(10);
  });

  it('accepts HH:MM style labels', function () {
    var txt = 'FLT TIME 10:30\nTAXI OUT 20\nTAXI IN 12';
    var r = parseNavlogFdpFields(txt);
    expect(r.fltMin).toBe(10 * 60 + 30);
    expect(r.taxiOutMin).toBe(20);
    expect(r.taxiInMin).toBe(12);
  });

  it('returns null for missing fields', function () {
    var r = parseNavlogFdpFields('NAVIGATION LOG\nRJAA-KLAX');
    expect(r.fltMin).toBeNull();
    expect(r.taxiOutMin).toBeNull();
    expect(r.taxiInMin).toBeNull();
  });
});

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
