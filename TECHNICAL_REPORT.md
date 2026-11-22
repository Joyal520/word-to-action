# Bible Promises — Technical Report & Deployment Guide

## 1. Deliverables

- [bible-promises.html](file:///c:/Users/hecsb/OneDrive/Desktop/The%20bible%20app/bible-promises.html) — Complete production-ready devotional PWA (self-contained offline Tamil + KJV fallback + 823 promises).
- [manifest.webmanifest](file:///c:/Users/hecsb/OneDrive/Desktop/The%20bible%20app/manifest.webmanifest) — Web App Manifest for Android, Windows, Desktop, and iOS installability.
- [sw.js](file:///c:/Users/hecsb/OneDrive/Desktop/The%20bible%20app/sw.js) — Versioned Service Worker (`bp-shell-v1`, `bp-fonts-v1`, `bp-api-v1`) with offline shell fallback and controlled update lifecycle.
- `icons/` — Generated PNG app icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`).
- [VALIDATION_REPORT.md](file:///c:/Users/hecsb/OneDrive/Desktop/The%20bible%20app/VALIDATION_REPORT.md) — Full content, Tamil PDF, and KJV validation report.
- `bible-promises (1).html` — Preserved untouched as the original baseline reference.

---

## 2. Audit Findings & Bugs Fixed

1. **Missing English Book Names (`"undefined"` references):** `BN` only had 51 of 66 books (`JDG`, `1KI`, `HOS`, `EZK`, `JUD` were missing), causing `"undefined"` in English references for `XR` promises. Populated all 66 canonical books in `BN`.
2. **Tamil Book Name Typo:** Fixed `BNT["2TI"]` from `"2 தீமோத்தேயு்"` to `"2 தீமோத்தேயு"`.
3. **Bamini PDF Extraction Bugs:** Fixed 31 leaked trailing chapter-header book names, restored missing `"அதிகாரம்"` in `MAT.9.6.6` and `LUK.5.24.24`, fixed `1SA.2.9.9` (`மௌ`), fixed invalid pullis in `PRO.1.33.33` and `GAL.5.18.18`, and restored clause semicolons in `2CO.4.8-9`, `2CO.4.16`, `2CO.5.17`, and `EPH.5.25`.
4. **HelloAO KJV Translation Selection & Pilcrow Cleanup:** Original `kjvIds()` matched `eng_kja` (KJV + Apocrypha) before `eng_kjv`; pinned `eng_kjv` (public domain) and stripped leading `¶ ` markers.
5. **Leap-Year Daily Promise Bug:** Original `doy()` shifted March 1–Dec 31 by +1 day in leap years (making Dec 31 wrap to Day 1). Replaced with a deterministic non-leap month table `MDAYS` + dedicated Leap Day (Feb 29 → ID `366`) using local calendar date (`getFullYear`, `getMonth`, `getDate`) without UTC drift.
6. **Search Input Focus Loss:** Original `sr()` replaced `#app.innerHTML` on every keystroke, breaking mobile keyboards and Tamil IME composition. Refactored to update only `#res` and `#cnt` while preserving `#q` focus.
7. **PWA Manifest & Service Worker Missing:** Original app used an ephemeral `blob:` manifest without icons or a Service Worker. Added `manifest.webmanifest`, `sw.js`, and 4 PNG icons. Also fixed a same-origin navigation cache bug discovered during browser testing so non-HTML routes (e.g. `/sw.js`) never overwrite `./bible-promises.html` in `bp-shell-v1`.
8. **My Promises Live Count:** Fixed `#mcnt` in My Promises so removing a saved promise updates the header count immediately.

---

## 3. Architecture, Offline, API & Security Improvements

- **Offline-First PWA & API Resilience:**
  - Tamil Scripture (`TV`, 882 keys) and public-domain KJV fallback (`EV`, 882 keys) are bundled locally for 100% offline reliability.
  - When online, English verses fetch from `https://bible.helloao.org/api/eng_kjv/{BOOK}/{CH}.simple.json` (CORS `*`, 5s `AbortController` timeout, race-condition guard `renderSeq`), cached in structured `bp.vcache` (`tr|book|ch|v1-v2`, LRU cap 400) and `bp-api-v1` in `sw.js`.
  - Never displays empty Scripture, raw JSON, API error dumps, or `"undefined"`.
- **Storage Safety & Backup/Restore:**
  - `SafeLS` wrapper handles malformed JSON, `null`, out-of-range settings, invalid saved IDs, `QuotaExceededError` eviction, and migrates legacy `bp.k.*` / `bp.set` / `bp.saved` data cleanly (`bp.ver = 2`).
  - Export Backup downloads JSON; Restore validates schema/types strictly and previews saved count in a confirmation dialog before overwriting.
- **Daily Reminders (Honest Local Implementation):**
  - Opt-in toggle requests `Notification.requestPermission()` only on explicit user action; schedules local in-session timer + missed check once per local day.
  - Includes one-tap **Recurring Calendar Alert (`.ics`)** download (works offline on Android, iOS, and Windows without a backend) and clearly explains browser background notification limits in English and Tamil.
- **Accessibility & Performance:**
  - WCAG AA contrast scrims on `.cat` and `.tag`, `@media (forced-colors: active)` `h1` fallback, `:focus-visible` outlines, ≥ 44px touch targets, semantic `<button>` / `<article>` / `<dialog>` elements, `@media (prefers-reduced-motion: reduce)`, skip link, and lazy pre-built `SEARCH_IDX` with 40-item pagination.
- **Security:**
  - Zero inline `onclick`/`oninput`/`onchange` attributes (100% delegated listeners), complete `esc()` HTML escaping, zero `eval()`, zero API keys, zero external JS frameworks.

---

## 4. Verification Summary

- **Automated Python & Node Suites (`run_tests.py`, `run_tests.mjs`):**
  - `823/823` IDs, categories, books, chapters, and verses match `bible-promises (1).html` 1-for-1.
  - `823/823` `CP` and `815/815` `CX` pass all validation rules (`0` invalid, `0` `"undefined"`).
  - `node --check` passed on extracted app `<script>` and `sw.js`; `manifest.webmanifest` and PNG headers verified.
  - Leap-year (`2028`) and non-leap (`2026`) daily calendar, corrupted `localStorage` recovery, legacy migration, and backup validation all passed.
- **Live Browser Verification (`http://localhost:8765/bible-promises.html`):**
  - Zero console errors, zero failed requests; verified Home devotional steps, Prev/Next/Today, Save/Remove, Share modal + Copy, Promises search + category filter, Categories drill-down, Tamil/English instant toggle, Dark mode, Text size, `.ics` reminder download, JSON backup download, and responsive layouts at `360×740`, `412×915`, `768×1024`, and `1280×800`.
  - *Note on offline test limitation:* The automated webview sandbox did not expose `setOffline()` / `page.route()`, so offline Service Worker behavior was verified via `sw.js` code inspection, active SW interception checks, and offline `EV`/`TV` fallback paths.

---

## 5. Deployment, Installation & Maintenance Instructions

### Run Locally
Service Workers require `http://localhost` or `https://` (not `file://`):
```powershell
cd "c:\Users\hecsb\OneDrive\Desktop\The bible app"
python -m http.server 8765
```
Open `http://localhost:8765/bible-promises.html`.

### Deploy to Production
Upload these files/folders together to any static HTTPS host (GitHub Pages, Cloudflare Pages, Netlify, Firebase Hosting, or Nginx/Apache):
- `bible-promises.html` (or optionally copy/alias as `index.html`)
- `manifest.webmanifest`
- `sw.js`
- `icons/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`)

### Install as App
- **Android (Chrome/Edge):** Open the site → tap browser menu → **Install app** (or tap **Install App on Device** in Settings).
- **Windows / Desktop (Chrome/Edge):** Click the install icon in the address bar → **Install**.
- **iOS (Safari):** Tap **Share** → **Add to Home Screen**.

### Update the App & Clear Caches Safely
1. When deploying a new version, increment `CACHE_VERSION` in `sw.js` (e.g., `'v1'` → `'v2'`).
2. Existing users will see the **"A new version of Bible Promises is ready — Update Now"** banner automatically; tapping **Update Now** activates the new Service Worker, cleans old `bp-*` caches, and preserves all saved promises and settings in `localStorage`.
3. Users can clear cached API verses anytime in **Settings → Clear cached API verses**, or export a JSON backup before using **Clear all local data**.
