# PWA Manifest — Design Spec

**Date:** 2026-06-08

## Context

The gift-guide app is deployed as a Node/Vue SPA. When added to an iPhone home screen, it runs as a plain Safari web clip with no manifest. iOS therefore opens every navigation in a new Safari window on top of the clip instead of routing in-place. There is also no proper app icon — iOS auto-generates a screenshot thumbnail.

The goal is to make the app behave correctly as a standalone web app: no browser chrome, no new-window navigation, and a recognisable 🎁 icon on the home screen.

## Approach

Minimal PWA: manifest + meta tags + safe-area CSS + icon PNGs. No service worker.

## Changes

### 1. Icon generation script

`scripts/gen-icons.js` — run once with `node scripts/gen-icons.js`, uses the built-in `canvas` module (add `canvas` as a devDependency if not present). Generates three PNG files in `client/public/icons/`:

- `icon-180.png` — apple-touch-icon (180×180)
- `icon-192.png` — manifest icon (192×192)
- `icon-512.png` — manifest icon (512×512)

Each: `#fffbeb` cream background, 🎁 emoji centred, sized to ~65% of the canvas.

### 2. `client/public/manifest.webmanifest`

```json
{
  "name": "The Great Gift Guide",
  "short_name": "Gift Guide",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fffbeb",
  "theme_color": "#d97706",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 3. `client/index.html` — add to `<head>`

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#d97706" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Gift Guide" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icons/icon-180.png" />
```

Also update the existing viewport meta to add `viewport-fit=cover`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### 4. `client/src/style.css` — safe-area insets

The bottom nav must clear the iOS home indicator, and the FAB must float above it.

```css
/* Bottom nav */
.nav-btn-container {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

The nav wrapper is the `<nav>` element in `BottomNav.vue`. Add `pb-safe` utility or inline style. In practice: add `padding-bottom: env(safe-area-inset-bottom, 0px)` to the `.nav-btn` container `<nav>` element in `style.css` by targeting `#app-card nav` or a dedicated class.

FAB is positioned with `bottom: 5rem` in `#app-card .fab-add` — change to:
```css
#app-card .fab-add { bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }
```

### 5. `.gitignore`

Add `/client/public/icons/` only if not committing generated icons. Since these are small PNGs committed to the repo, no gitignore change is needed. Add `.superpowers/` to `.gitignore` if not already present.

## Files modified

- `scripts/gen-icons.js` (new)
- `client/public/manifest.webmanifest` (new)
- `client/public/icons/icon-180.png` (new, generated)
- `client/public/icons/icon-192.png` (new, generated)
- `client/public/icons/icon-512.png` (new, generated)
- `client/index.html` (meta tags)
- `client/src/style.css` (safe-area insets)
- `package.json` (add `canvas` devDep if needed)
- `.gitignore` (add `.superpowers/`)

## Verification

1. Deploy to production (or run `npm run dev` locally)
2. Open in Safari on iPhone → Share → Add to Home Screen
3. Tap the home screen icon — app opens full-screen, no URL bar
4. Tap through all bottom nav tabs — no new Safari window opens
5. Check the icon: cream background with 🎁 emoji
6. Rotate to landscape — nav still visible above home indicator

**Note for user:** Remove any existing home screen shortcut before re-adding; iOS does not auto-upgrade web clips to standalone mode.
