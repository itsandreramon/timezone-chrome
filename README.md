# Timezone Converter

Chrome extension that detects time strings on web pages (e.g. `4:30pm PT`, `16:30 UTC`) and appends the equivalent in your selected timezone inline.

**Before:**
> The meeting starts at 4:30pm PT.

**After:**
> The meeting starts at 4:30pm PT (1:30am CEST).

## Features

- Converts common timezone abbreviations: PT, PST, PDT, ET, EST, EDT, CT, CST, CDT, MT, MST, MDT, UTC, GMT, CET, CEST, BST, IST, JST, KST, HKT, SGT, AEST, AEDT, NZST, NZDT, AKST, AKDT, HST, WET, WEST, EET, EEST
- Supports 12h (`4:30pm PT`) and 24h (`16:30 UTC`) formats
- Shows `+1` / `-1` when the conversion crosses a day boundary
- Toggle on/off from the popup without reloading the page
- Pick your timezone from a grouped dropdown (defaults to your browser's local timezone)
- Handles dynamic content (SPAs, infinite scroll) via MutationObserver
- No network requests — all conversion is client-side

## Install

1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `timezone-chrome` folder

## Usage

Click the extension icon to open the popup. Pick your timezone and toggle the extension on or off. Converted times appear inline on every page.

## Testing

Open `test.html` in Chrome after loading the extension to verify conversions across different formats and edge cases.

## License

MIT
