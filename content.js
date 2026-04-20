(() => {
  const { TZ_OFFSETS, TIME_RE, convertTime, findMatches } = window.TimezoneConverter;
  const MARKER = 'data-tz-converted';
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
    return (new Date(localStr) - new Date(utcStr)) / 60000;
  }

  function processTextNode(node) {
    const text = node.textContent;
    if (!text) return;

    const matches = findMatches(text);
    if (matches.length === 0) return;

    const tzAbbr = getUserTzAbbr();
    const targetOffset = getUserOffsetMinutes();
    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    for (const m of matches) {
      if (m.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }

      const converted = convertTime(m.hours, m.minutes, m.ampm, m.tz, targetOffset);
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
