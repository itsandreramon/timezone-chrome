(() => {
  const MARKER = 'data-tz-converted';

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
    `\\b(\\d{1,2}):(\\d{2})\\s*(am|pm|AM|PM|a\\.m\\.|p\\.m\\.|A\\.M\\.|P\\.M\\.)?\\s*(${TZ_ABBRS})\\b`,
    'g'
  );

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT', 'SVG']);

  let enabled = true;
  let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function getUserTzAbbr() {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        timeZoneName: 'short'
      }).formatToParts(new Date());
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart ? tzPart.value : '';
    } catch {
      return '';
    }
  }

  function getUserOffsetMinutes() {
    const now = new Date();
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const localStr = now.toLocaleString('en-US', { timeZone: userTimezone });
    const utcDate = new Date(utcStr);
    const localDate = new Date(localStr);
    return (localDate - utcDate) / 60000;
  }

  function convertTime(hours, minutes, ampm, sourceTzAbbr) {
    if (ampm) {
      const ap = ampm.replace(/\./g, '').toLowerCase();
      if (ap === 'pm' && hours !== 12) hours += 12;
      if (ap === 'am' && hours === 12) hours = 0;
    } else if (hours <= 23) {
      // 24h format, keep as-is
    }

    const sourceOffset = TZ_OFFSETS[sourceTzAbbr];
    if (sourceOffset === undefined) return null;

    const targetOffset = getUserOffsetMinutes();
    const totalSourceMinutes = hours * 60 + minutes;
    const utcMinutes = totalSourceMinutes - sourceOffset;
    const targetMinutes = utcMinutes + targetOffset;

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

  function processTextNode(node) {
    const text = node.textContent;
    if (!text) return;

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

    if (matches.length === 0) return;

    const tzAbbr = getUserTzAbbr();
    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    for (const m of matches) {
      if (m.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }

      const converted = convertTime(m.hours, m.minutes, m.ampm, m.tz);
      const span = document.createElement('span');
      span.setAttribute(MARKER, 'true');

      if (converted) {
        const tzLabel = tzAbbr ? ` ${tzAbbr}` : '';
        span.textContent = m.fullMatch + ` (${converted}${tzLabel})`;
      } else {
        span.textContent = m.fullMatch;
      }

      frag.appendChild(span);
      lastIndex = m.index + m.length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode.replaceChild(frag, node);
  }

  function shouldSkip(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.hasAttribute && el.hasAttribute(MARKER)) return true;
      el = el.parentElement;
    }
    return false;
  }

  function scanNode(root) {
    if (!enabled) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
        TIME_RE.lastIndex = 0;
        if (!TIME_RE.test(node.textContent)) return NodeFilter.FILTER_REJECT;
        TIME_RE.lastIndex = 0;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  }

  function removeConversions() {
    document.querySelectorAll(`[${MARKER}]`).forEach(span => {
      const text = span.textContent;
      const cleaned = text.replace(/\s*\(.*?\)$/, '');
      span.replaceWith(document.createTextNode(cleaned));
    });
  }

  function reprocess() {
    removeConversions();
    if (enabled) scanNode(document.body);
  }

  const observer = new MutationObserver(mutations => {
    if (!enabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!shouldSkip(node)) processTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          if (!shouldSkip(node) && !node.hasAttribute(MARKER)) {
            scanNode(node);
          }
        }
      }
    }
  });

  chrome.storage.local.get(['enabled', 'timezone'], result => {
    if (result.enabled === false) enabled = false;
    if (result.timezone) userTimezone = result.timezone;
    if (enabled) scanNode(document.body);

    observer.observe(document.body, { childList: true, subtree: true });
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
    }
    if (changes.timezone && changes.timezone.newValue) {
      userTimezone = changes.timezone.newValue;
    }
    reprocess();
  });
})();
