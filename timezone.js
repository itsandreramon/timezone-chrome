const TZ_OFFSETS = {
  PT: -480, PST: -480, PDT: -420,
  ET: -300, EST: -300, EDT: -240,
  CT: -360, CST: -360, CDT: -300,
  MT: -420, MST: -420, MDT: -360,
  UTC: 0, GMT: 0,
  CET: 60, CEST: 120,
  WET: 0, WEST: 60,
  EET: 120, EEST: 180,
  BST: 60,
  IST: 330,
  JST: 540,
  KST: 540,
  HKT: 480,
  SGT: 480,
  AEST: 600, AEDT: 660,
  NZST: 720, NZDT: 780,
  AKST: -540, AKDT: -480,
  HST: -600
};

const TZ_ABBRS = Object.keys(TZ_OFFSETS).sort((a, b) => b.length - a.length).join('|');
const TIME_RE = new RegExp(
  `(?<![\\d.])\\b(\\d{1,2}):(\\d{2})[ \\t]*(am|pm|AM|PM|a\\.m\\.|p\\.m\\.|A\\.M\\.|P\\.M\\.)?[ \\t]*(${TZ_ABBRS})\\b`,
  'g'
);

function convertTime(hours, minutes, ampm, sourceTzAbbr, targetOffsetMinutes) {
  if (typeof targetOffsetMinutes !== 'number' || isNaN(targetOffsetMinutes)) return null;
  if (minutes > 59) return null;

  if (ampm) {
    if (hours < 1 || hours > 12) return null;
    const ap = ampm.replace(/\./g, '').toLowerCase();
    if (ap === 'pm' && hours !== 12) hours += 12;
    if (ap === 'am' && hours === 12) hours = 0;
  } else {
    if (hours > 23) return null;
  }

  const sourceOffset = TZ_OFFSETS[sourceTzAbbr];
  if (sourceOffset === undefined) return null;

  const totalSourceMinutes = hours * 60 + minutes;
  const utcMinutes = totalSourceMinutes - sourceOffset;
  const targetMinutes = utcMinutes + targetOffsetMinutes;

  let finalMinutes = ((targetMinutes % 1440) + 1440) % 1440;
  let dayDiff = 0;
  if (targetMinutes >= 1440) dayDiff = Math.floor(targetMinutes / 1440);
  else if (targetMinutes < 0) dayDiff = -Math.ceil(-targetMinutes / 1440);

  const h = Math.floor(finalMinutes / 60);
  const m = finalMinutes % 60;

  let displayH = h % 12 || 12;
  const displayAmPm = h < 12 ? 'am' : 'pm';
  const displayM = m.toString().padStart(2, '0');

  let result = `${displayH}:${displayM}${displayAmPm}`;

  if (dayDiff > 0) result += ` +${dayDiff}`;
  else if (dayDiff < 0) result += ` ${dayDiff}`;

  return result;
}

function findMatches(text) {
  TIME_RE.lastIndex = 0;
  const matches = [];
  let match;
  while ((match = TIME_RE.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      fullMatch: match[0],
      hours: parseInt(match[1], 10),
      minutes: parseInt(match[2], 10),
      ampm: match[3] || null,
      tz: match[4]
    });
  }
  return matches;
}

const TimezoneConverter = { TZ_OFFSETS, TIME_RE, convertTime, findMatches };

if (typeof window !== 'undefined') window.TimezoneConverter = TimezoneConverter;
if (typeof module !== 'undefined') module.exports = TimezoneConverter;
