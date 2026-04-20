const TIMEZONES = [
  { group: 'Americas', zones: [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'America/Phoenix', 'America/Toronto', 'America/Vancouver',
    'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago',
    'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Pacific/Honolulu'
  ]},
  { group: 'Europe', zones: [
    'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid',
    'Europe/Rome', 'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Vienna',
    'Europe/Stockholm', 'Europe/Oslo', 'Europe/Helsinki', 'Europe/Warsaw',
    'Europe/Prague', 'Europe/Budapest', 'Europe/Bucharest', 'Europe/Athens',
    'Europe/Istanbul', 'Europe/Moscow', 'Europe/Lisbon', 'Europe/Dublin'
  ]},
  { group: 'Asia & Pacific', zones: [
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
    'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
    'Asia/Taipei', 'Asia/Jakarta', 'Asia/Karachi', 'Asia/Dhaka',
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
    'Pacific/Auckland', 'Pacific/Fiji'
  ]},
  { group: 'Africa & Middle East', zones: [
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
    'Africa/Casablanca', 'Asia/Jerusalem', 'Asia/Riyadh', 'Asia/Tehran'
  ]}
];

function formatTzLabel(tz) {
  const city = tz.split('/').pop().replace(/_/g, ' ');
  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
    return `${city} (${offset})`;
  } catch {
    return city;
  }
}

const toggle = document.getElementById('toggle');
const select = document.getElementById('timezone');
const status = document.getElementById('status');

TIMEZONES.forEach(({ group, zones }) => {
  const optgroup = document.createElement('optgroup');
  optgroup.label = group;
  zones.forEach(tz => {
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = formatTzLabel(tz);
    optgroup.appendChild(opt);
  });
  select.appendChild(optgroup);
});

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function ensureTzInList(tz) {
  if (!tz) return;
  for (const opt of select.options) {
    if (opt.value === tz) return;
  }
  const opt = document.createElement('option');
  opt.value = tz;
  opt.textContent = formatTzLabel(tz);
  select.prepend(opt);
}

ensureTzInList(browserTz);

chrome.storage.local.get(['enabled', 'timezone'], result => {
  toggle.checked = result.enabled !== false;
  const tz = result.timezone || browserTz;
  ensureTzInList(tz);
  select.value = tz;
  updateStatus();
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  updateStatus();
});

select.addEventListener('change', () => {
  chrome.storage.local.set({ timezone: select.value });
  updateStatus();
});

function updateStatus() {
  if (toggle.checked) {
    status.textContent = 'Converting times to ' + select.value.split('/').pop().replace(/_/g, ' ');
  } else {
    status.textContent = 'Extension disabled';
  }
}
