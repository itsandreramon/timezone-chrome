const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { convertTime, findMatches, TZ_OFFSETS, TIME_RE } = require('./timezone.js');

describe('convertTime', () => {
  it('converts 4:30pm PST to CET (UTC+1)', () => {
    assert.equal(convertTime(4, 30, 'pm', 'PST', 60), '1:30am +1');
  });

  it('converts 9:00am UTC to JST (UTC+9)', () => {
    assert.equal(convertTime(9, 0, 'am', 'UTC', 540), '6:00pm');
  });

  it('converts 14:00 UTC to JST (24h format, no ampm)', () => {
    assert.equal(convertTime(14, 0, null, 'UTC', 540), '11:00pm');
  });

  it('handles midnight crossing forward (+1 day)', () => {
    assert.equal(convertTime(11, 30, 'pm', 'PST', 60), '8:30am +1');
  });

  it('handles midnight crossing backward (-1 day)', () => {
    assert.equal(convertTime(1, 0, 'am', 'CET', -600), '2:00pm -1');
  });

  it('handles 12:00pm (noon) correctly', () => {
    assert.equal(convertTime(12, 0, 'pm', 'ET', 0), '5:00pm');
  });

  it('handles 12:00am (midnight) correctly', () => {
    assert.equal(convertTime(12, 0, 'am', 'PST', 0), '8:00am');
  });

  it('handles half-hour offset timezone (IST UTC+5:30)', () => {
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
    assert.equal(convertTime(3, 0, 'pm', 'PST', -480), '3:00pm');
  });

  it('converts PDT to EDT', () => {
    assert.equal(convertTime(2, 0, 'pm', 'PDT', -240), '5:00pm');
  });

  it('returns null for invalid minutes (> 59)', () => {
    assert.equal(convertTime(9, 99, 'am', 'UTC', 0), null);
    assert.equal(convertTime(9, 60, 'am', 'UTC', 0), null);
  });

  it('returns null for hours > 23 in 24h format', () => {
    assert.equal(convertTime(24, 0, null, 'UTC', 0), null);
    assert.equal(convertTime(25, 30, null, 'UTC', 0), null);
  });

  it('returns null for hours > 12 with am/pm', () => {
    assert.equal(convertTime(13, 0, 'am', 'UTC', 0), null);
    assert.equal(convertTime(14, 0, 'pm', 'UTC', 0), null);
  });

  it('returns null for hour 0 with am/pm', () => {
    assert.equal(convertTime(0, 0, 'am', 'UTC', 0), null);
  });

  it('returns null for NaN target offset', () => {
    assert.equal(convertTime(9, 0, 'am', 'UTC', NaN), null);
  });

  it('returns null for undefined target offset', () => {
    assert.equal(convertTime(9, 0, 'am', 'UTC', undefined), null);
  });

  it('handles 23:59 in 24h format', () => {
    assert.equal(convertTime(23, 59, null, 'UTC', 60), '12:59am +1');
  });

  it('handles 0:00 in 24h format', () => {
    assert.equal(convertTime(0, 0, null, 'UTC', 0), '12:00am');
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

  it('does not match after decimal points', () => {
    assert.equal(findMatches('3.14:15 JST').length, 0);
  });

  it('does not match IP-like patterns', () => {
    assert.equal(findMatches('192.168.1.0:30pm PST').length, 0);
  });

  it('does not match across newlines', () => {
    assert.equal(findMatches('9:00am\nPST').length, 0);
    assert.equal(findMatches('9:00am\n\nPST').length, 0);
  });

  it('matches with tab separator', () => {
    const matches = findMatches('9:00am\tPST');
    assert.equal(matches.length, 1);
  });

  it('matches all supported timezone abbreviations', () => {
    const abbrs = Object.keys(TZ_OFFSETS);
    for (const tz of abbrs) {
      const matches = findMatches(`9:00am ${tz}`);
      assert.equal(matches.length, 1, `should match timezone ${tz}`);
      assert.equal(matches[0].tz, tz);
    }
  });

  it('match length equals fullMatch length', () => {
    const matches = findMatches('at 4:30pm PT ok');
    assert.equal(matches[0].length, matches[0].fullMatch.length);
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
