// FDP / Block limit calculator (pure functions, ES5)

var FDP_TABLE_SINGLE = [
  { startHour: 0,  endHour: 4,  fdpMin: [660, 630, 600, 570, 540, 540, 540, 540, 540] },
  { startHour: 5,  endHour: 5,  fdpMin: [720, 690, 660, 630, 600, 570, 540, 540, 540] },
  { startHour: 6,  endHour: 13, fdpMin: [780, 750, 720, 690, 660, 630, 600, 570, 540] },
  { startHour: 14, endHour: 15, fdpMin: [720, 690, 660, 630, 600, 570, 540, 540, 540] },
  { startHour: 16, endHour: 23, fdpMin: [660, 630, 600, 570, 540, 540, 540, 540, 540] }
];

var BLK_TABLE_SINGLE = [
  { startHour: 0,  endHour: 4,  blkMin: [540, 480] },
  { startHour: 5,  endHour: 16, blkMin: [600, 540] },
  { startHour: 17, endHour: 23, blkMin: [540, 480] }
];

var FDP_TABLE_MULTI = {
  multi:  { 1: [1020, 960], 2: [960, 900], 3: [900, 840] },
  double: { 1: [1080, 1020], 2: [1020, 960], 3: [960, 900] }
};

var BLK_BASE_MULTI = 900;
var BLK_BASE_DOUBLE = 1020;
var BLK_MULTI_DOWNGRADE = 779;

function fdpPad2(n) {
  return (n < 10 ? '0' : '') + String(n);
}

function fdpFindTableRow(table, suHour) {
  var i, row;
  for (i = 0; i < table.length; i++) {
    row = table[i];
    if (suHour >= row.startHour && suHour <= row.endHour) return row;
  }
  return null;
}

function fdpSectorIdxSingle(sectors) {
  var s = sectors;
  if (s < 1) s = 1;
  if (s > 10) s = 10;
  if (s <= 2) return 0;
  var idx = s - 2;
  if (idx > 8) idx = 8;
  return idx;
}

function fdpSectorColMulti(sectors) {
  var s = sectors;
  if (s < 1) s = 1;
  return s <= 2 ? 0 : 1;
}

function fdpClampInt(v, lo, hi) {
  var n = parseInt(v, 10);
  if (isNaN(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function parseTimeInput(str) {
  if (str === null || str === undefined) return null;
  var s = String(str).trim().replace(/[^0-9:]/g, '');
  if (!s) return null;

  var h, m;
  if (s.indexOf(':') >= 0) {
    var parts = s.split(':');
    if (parts.length !== 2) return null;
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else if (s.length === 1 || s.length === 2) {
    h = parseInt(s, 10);
    m = 0;
  } else if (s.length === 3) {
    h = parseInt(s.charAt(0), 10);
    m = parseInt(s.substr(1, 2), 10);
  } else if (s.length === 4) {
    h = parseInt(s.substr(0, 2), 10);
    m = parseInt(s.substr(2, 2), 10);
  } else {
    return null;
  }

  if (isNaN(h) || isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hour: h, min: m };
}

function parseHmToMinutes(str) {
  var p = parseTimeInput(str);
  if (!p) return null;
  return p.hour * 60 + p.min;
}

function parseSuHmToParts(str) {
  var p = parseTimeInput(str);
  if (!p) return null;
  return { suHour: p.hour, suMin: p.min };
}

function formatDurationMin(totalMin) {
  if (totalMin === null || totalMin === undefined || isNaN(totalMin)) return '—';
  var t = Math.max(0, Math.round(Number(totalMin)));
  var h = Math.floor(t / 60);
  var m = t % 60;
  return fdpPad2(h) + ':' + fdpPad2(m);
}

function formatWallClockMin(totalMin) {
  if (totalMin === null || totalMin === undefined || isNaN(totalMin)) return '—';
  var t = Math.round(Number(totalMin));
  var dayOffset = 0;
  while (t >= 1440) { t -= 1440; dayOffset++; }
  while (t < 0) { t += 1440; dayOffset--; }
  var h = Math.floor(t / 60);
  var m = t % 60;
  var out = fdpPad2(h) + ':' + fdpPad2(m);
  if (dayOffset > 0) out += ' (+' + dayOffset + ')';
  else if (dayOffset < 0) out += ' (' + dayOffset + ')';
  return out;
}

function computeFdpLimit(input) {
  var warnings = [];
  var inObj = input || {};
  var suHour = fdpClampInt(inObj.suHour, 0, 23);
  var suMin = fdpClampInt(inObj.suMin, 0, 59);
  var sectors = fdpClampInt(inObj.sectors, 1, 10);
  var crew = inObj.crew || 'single';
  var restClass = fdpClampInt(inObj.restClass, 1, 3);
  var fltMin = (inObj.fltMin === null || inObj.fltMin === undefined || inObj.fltMin === '') ? null : Number(inObj.fltMin);
  if (fltMin !== null && (isNaN(fltMin) || fltMin <= 0)) fltMin = null;
  var taxiOutMin = fdpClampInt(inObj.taxiOutMin, 0, 999);
  var taxiInMin = fdpClampInt(inObj.taxiInMin, 0, 999);

  var maxFdpMin = null;
  var maxBlkMin = null;
  var row, secIdx, secCol, rcKey;

  if (crew === 'single') {
    row = fdpFindTableRow(FDP_TABLE_SINGLE, suHour);
    if (row) {
      secIdx = fdpSectorIdxSingle(sectors);
      maxFdpMin = row.fdpMin[secIdx];
    }
    row = fdpFindTableRow(BLK_TABLE_SINGLE, suHour);
    if (row) {
      secCol = sectors <= 2 ? 0 : 1;
      maxBlkMin = row.blkMin[secCol];
    }
  } else if (crew === 'multi') {
    secCol = fdpSectorColMulti(sectors);
    rcKey = restClass;
    if (FDP_TABLE_MULTI.multi[rcKey]) {
      maxFdpMin = FDP_TABLE_MULTI.multi[rcKey][secCol];
    }
    maxBlkMin = (restClass === 1) ? BLK_BASE_MULTI : BLK_MULTI_DOWNGRADE;
    if (restClass === 1) {
      warnings.push('マルチプル編成での 15h 運用には Class 1 仮眠設備が必須');
    }
  } else if (crew === 'double') {
    secCol = fdpSectorColMulti(sectors);
    rcKey = restClass;
    if (FDP_TABLE_MULTI.double[rcKey]) {
      maxFdpMin = FDP_TABLE_MULTI.double[rcKey][secCol];
    }
    if (restClass === 1) {
      maxBlkMin = BLK_BASE_DOUBLE;
    } else if (maxFdpMin !== null) {
      maxBlkMin = Math.min(maxFdpMin, BLK_BASE_DOUBLE);
    } else {
      maxBlkMin = BLK_BASE_DOUBLE;
    }
  }

  if (maxFdpMin === null) maxFdpMin = 0;
  if (maxBlkMin === null) maxBlkMin = 0;

  var suTotalMin = suHour * 60 + suMin;
  var latestBlockInMin = suTotalMin + maxFdpMin;
  var latestTakeoffMin = null;
  var latestBlockOutMin = null;

  if (fltMin !== null && fltMin > 0) {
    latestTakeoffMin = latestBlockInMin - taxiInMin - fltMin;
    latestBlockOutMin = latestTakeoffMin - taxiOutMin;
    var plannedBlk = fltMin + taxiOutMin + taxiInMin;
    if (plannedBlk > maxBlkMin) {
      var over = plannedBlk - maxBlkMin;
      warnings.push('計画 Block time が上限を超過 (' + over + ' 分オーバー)');
    }
  }

  return {
    maxFdpMin: maxFdpMin,
    maxBlkMin: maxBlkMin,
    latestBlockInMin: latestBlockInMin,
    latestTakeoffMin: latestTakeoffMin,
    latestBlockOutMin: latestBlockOutMin,
    warnings: warnings
  };
}

var FdpCalcExports = {
  FDP_TABLE_SINGLE: FDP_TABLE_SINGLE,
  BLK_TABLE_SINGLE: BLK_TABLE_SINGLE,
  FDP_TABLE_MULTI: FDP_TABLE_MULTI,
  BLK_BASE_MULTI: BLK_BASE_MULTI,
  BLK_BASE_DOUBLE: BLK_BASE_DOUBLE,
  BLK_MULTI_DOWNGRADE: BLK_MULTI_DOWNGRADE,
  computeFdpLimit: computeFdpLimit,
  parseTimeInput: parseTimeInput,
  parseHmToMinutes: parseHmToMinutes,
  parseSuHmToParts: parseSuHmToParts,
  formatDurationMin: formatDurationMin,
  formatWallClockMin: formatWallClockMin
};

if (typeof window !== 'undefined') {
  window.FdpCalc = FdpCalcExports;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FdpCalcExports;
}
