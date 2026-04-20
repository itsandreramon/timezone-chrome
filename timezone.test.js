const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { convertTime, findMatches, TZ_OFFSETS, TIME_RE } = require('./timezone.js');

describe('convertTime', () => {
  it('converts 4:30pm PST to CET (UTC+1)', () => {
    // PST = -480, CET = +60 → target offset = 60
    // 4:30pm = 16:30 → 16*60+30 = 990
    // utc = 990 - (-480) = 1470 → target = 1470 + 60 = 1530
    // 1530 % 1440 = 90 → 1:30am, dayDiff = 1
    assert.equal(convertTime(4, 30, 'pm', 'PST', 60), '1:30am +1');
  });

  it('converts 9:00am UTC to JST (UTC+9)', () => {
    // UTC = 0, JST = +540
    // 9:00am = 9*60 = 540
    // utc = 540 - 0 = 540 → target = 540 + 540 = 1080
    // 1080 / 60 = 18:00 → 6:00pm
    assert.equal(convertTime(9, 0, 'am', 'UTC', 540), '6:00pm');
  });

  it('converts 14:00 UTC to JST (24h format, no ampm)', () => {
    // 14*60 = 840 → utc = 840 → target = 840 + 540 = 1380
    // 1380 / 60 = 23:00 → 11:00pm
    assert.equal(convertTime(14, 0, null, 'UTC', 540), '11:00pm');
  });

  it('handles midnight crossing forward (+1 day)', () => {
    // 11:30pm PST → CET (+60)
    // 23:30 = 1410 → utc = 1410 + 480 = 1890 → target = 1890 + 60 = 1950
    // 1950 % 1440 = 510 → 8:30am, dayDiff = 1
    assert.equal(convertTime(11, 30, 'pm', 'PST', 60), '8:30am +1');
  });

  it('handles midnight crossing backward (-1 day)', () => {
    // 1:00am CET → HST (-600)
    // 1:00 = 60 → utc = 60 - 60 = 0 → target = 0 + (-600) = -600
    // ((-600 % 1440) + 1440) % 1440 = 840 → 2:00pm, dayDiff = -1
    assert.equal(convertTime(1, 0, 'am', 'CET', -600), '2:00pm -1');
  });

  it('handles 12:00pm (noon) correctly', () => {
    // 12pm ET → UTC (0)
    // ET = -300, 12pm = 12:00 = 720
    // utc = 720 - (-300) = 1020 → target = 1020 + 0 = 1020
    // 1020 / 60 = 17:00 → 5:00pm
    assert.equal(convertTime(12, 0, 'pm', 'ET', 0), '5:00pm');
  });

  it('handles 12:00am (midnight) correctly', () => {
    // 12am PST → UTC (0)
    // 12am = 0:00 = 0
    // utc = 0 - (-480) = 480 → target = 480 + 0 = 480
    // 480 / 60 = 8:00 → 8:00am
    assert.equal(convertTime(12, 0, 'am', 'PST', 0), '8:00am');
  });

  it('handles half-hour offset timezone (IST UTC+5:30)', () => {
    // 12:00pm UTC → IST (+330)
    // 12*60 = 720 → utc = 720 → target = 720 + 330 = 1050
    // 1050 / 60 = 17.5 → 17:30 → 5:30pm
    assert.equal(convertTime(12, 0, 'pm', 'UTC', 330), '5:30pm');
  });

  it('converts with AM/PM case variations', () => {
    assert.equal(convertTime(4, 30, 'PM', 'PST', 60), '1:30am +1');
    assert.equal(convertTime(9, 0, 'AM', 'UTC', 540), '6:00pm');
  });

  it('converts with dotted am/pm', () => {
    assert.equal(convertTime(4, 30, 'p.m.', 'PST', 60), '1:30am +1');
    assert.equal(convertTime(9, 0, 'a.m.', 'UTC', 540), '6:00pm');
  });

  it('returns null for unknown timezone', () => {
    assert.equal(convertTime(9, 0, 'am', 'FAKE', 0), null);
  });

  it('same timezone conversion returns same time', () => {
    // 3:00pm PST → PST (-480)
    assert.equal(convertTime(3, 0, 'pm', 'PST', -480), '3:00pm');
  });

  it('converts PDT to EDT', () => {
    // PDT = -420, EDT = -240
    // 2:00pm PDT → 14*60 = 840 → utc = 840 + 420 = 1260 → target = 1260 - 240 = 1020
    // 1020 / 60 = 17:00 → 5:00pm
    assert.equal(convertTime(2, 0, 'pm', 'PDT', -240), '5:00pm');
  });
});

describe('findMatches', () => {
  it('matches 12h time with timezone abbreviation', () => {
    const matches = findMatches('meeting at 4:30pm PT today');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].hours, 4);
    assert.equal(matches[0].minutes, 30);
    assert.equal(matches[0].ampm, 'pm');
    assert.equal(matches[0].tz, 'PT');
    assert.equal(matches[0].fullMatch, '4:30pm PT');
  });

  it('matches 24h time with timezone', () => {
    const matches = findMatches('deploy at 14:00 UTC');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].hours, 14);
    assert.equal(matches[0].minutes, 0);
    assert.equal(matches[0].ampm, null);
    assert.equal(matches[0].tz, 'UTC');
  });

  it('matches multiple times in one string', () => {
    const matches = findMatches('from 9:00am ET to 5:00pm PT');
    assert.equal(matches.length, 2);
    assert.equal(matches[0].tz, 'ET');
    assert.equal(matches[1].tz, 'PT');
  });

  it('matches time with space before AM/PM', () => {
    const matches = findMatches('at 4:30 PM PST');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].ampm, 'PM');
    assert.equal(matches[0].tz, 'PST');
  });

  it('matches 4-letter timezone abbreviations', () => {
    const matches = findMatches('it is 8:00am AEST');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].tz, 'AEST');
  });

  it('returns empty array for text without times', () => {
    assert.equal(findMatches('no times here').length, 0);
  });

  it('does not match bare times without timezone', () => {
    assert.equal(findMatches('score was 3:45 in the final').length, 0);
  });

  it('does not match time-like patterns without proper boundary', () => {
    assert.equal(findMatches('version2:30pm PST').length, 0);
  });

  it('matches all supported timezone abbreviations', () => {
    const abbrs = Object.keys(TZ_OFFSETS);
    for (const tz of abbrs) {
      const matches = findMatches(`9:00am ${tz}`);
      assert.equal(matches.length, 1, `should match timezone ${tz}`);
      assert.equal(matches[0].tz, tz);
    }
  });
});

describe('TZ_OFFSETS', () => {
  it('has standard and daylight entries for US timezones', () => {
    assert.equal(TZ_OFFSETS.PST, -480);
    assert.equal(TZ_OFFSETS.PDT, -420);
    assert.equal(TZ_OFFSETS.EST, -300);
    assert.equal(TZ_OFFSETS.EDT, -240);
    assert.equal(TZ_OFFSETS.CST, -360);
    assert.equal(TZ_OFFSETS.CDT, -300);
    assert.equal(TZ_OFFSETS.MST, -420);
    assert.equal(TZ_OFFSETS.MDT, -360);
  });

  it('has UTC and GMT at zero', () => {
    assert.equal(TZ_OFFSETS.UTC, 0);
    assert.equal(TZ_OFFSETS.GMT, 0);
  });

  it('has correct offset for IST (half-hour)', () => {
    assert.equal(TZ_OFFSETS.IST, 330);
  });

  it('has correct offset for NZDT (+13 equivalent)', () => {
    assert.equal(TZ_OFFSETS.NZDT, 780);
  });
});
