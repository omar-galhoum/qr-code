# QR Code Generator

A small QR code generator built with plain HTML, CSS and JavaScript — no build step, no framework, no bundler. Type text, watch the code appear.

## Features

- **Live preview** — the code regenerates as you type (150 ms debounce)
- **Download PNG** — exports at the chosen size, rendered at device resolution
- **Copy to clipboard** — puts the image straight on your clipboard
- **Customization** — size (128–1024 px), foreground/background colours, error correction level L/M/Q/H
- **Light & dark theme** — persists across reloads, defaults to your system preference
- **Offline** — the QR library is vendored in `vendor/`, so there are no CDN requests

## Quick start

```bash
# Option 1 — just open it
open index.html

# Option 2 — serve it (needed for clipboard access outside localhost)
python3 -m http.server 8000
# → http://localhost:8000
```

The clipboard API requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), so `file://` may block copying. Downloading works either way.

## Controls

| Control | Range / options | Default | What it does |
|---|---|---|---|
| Content | any text or URL | — | The data encoded into the code |
| Size | 128–1024 px | 320 px | Output width; the PNG matches it |
| Error correction | L, M, Q, H | M | Tolerance for damage vs. data capacity |
| Foreground | any hex colour | `#101418` | The dark modules |
| Background | any hex colour | `#ffffff` | The light modules and quiet zone |

The contrast readout below the colour pickers reports the WCAG ratio between your two colours. Anything under **3:1** generally won't scan — keep the pair far apart in luminance.

### Error correction levels

| Level | Damage tolerated | Effect on capacity |
|---|---|---|
| **L** | ~7% | Most data fits |
| **M** | ~15% | Balanced — the default |
| **Q** | ~25% | Less data fits |
| **H** | ~30% | Least data, most durable |

Higher levels help when the code will be printed small, screenshotted, or exposed to wear. Push content past the limit and you'll get a friendly error instead of a broken code.

## Project structure

```
qr-code-generator/
├── index.html           162 lines  — markup
├── style.css            564 lines  — layout + both themes
├── script.js            360 lines  — QR logic + interactions
└── vendor/
    └── qrcode.min.js      20 KB    — QR encoding (MIT)
```

## How it works

Four decisions that aren't obvious from a quick read:

**UTF-8 encoding is overridden.** `qrcode-generator` defaults to a Latin-1 byte converter, which silently mangles Arabic, CJK and emoji into wrong modules. The fix is one line:

```js
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
```

**Modules are drawn with integer boundaries.** The canvas is sized to `size × devicePixelRatio`, and each module edge is snapped with `Math.round(i * cell)`. Adjacent modules then share exact pixel edges — otherwise fractional coordinates leave anti-aliased hairline seams between them, which scanners tend to hate.

**Copy passes a `Promise<ClipboardItem>`.** Safari only accepts clipboard image writes that are created synchronously inside the user gesture, so the blob is handed over as a promise rather than awaited first. Chrome accepts the same shape.

**The theme is applied before first paint.** A tiny inline script in `<head>` reads `localStorage` (falling back to `prefers-color-scheme`) and sets `data-theme`, so the page never flashes the wrong palette.

Error correction is chosen automatically — `qrcode(0, level)` picks the smallest version that fits the data, so version numbers are never managed by hand.

## Verification

Two layers of checks back this project:

- **Logic harness** (JavaScriptCore) — confirms generation is deterministic, the UTF-8 override actually changes the output matrix versus Latin-1, all four EC levels produce correct sizes, the overflow error throws and matches the catch pattern, contrast math returns 21.00 for black/white, and module tiling stays strictly increasing across 18 combinations of size × module count × device pixel ratio.
- **Static wiring check** (Python) — every `getElementById` target exists, every `#id` selector matches real markup, all classes are styled, HTML tags balance, both themes define the same token set, and every `var()` resolves.

Live browser testing has **not** been run — the desktop browser was unavailable during development. Layout and interaction should be spot-checked before relying on this.

## Credits

QR encoding by [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase, licensed under the [MIT License](https://opensource.org/licenses/MIT). Vendored unmodified in `vendor/qrcode.min.js`.

The QR Code standard is a registered trademark of DENSO WAVE INCORPORATED, who hold the patent and have [granted royalty-free licensing](https://www.qrcode.com/en/faq.html#about-patent) for QR codes.

## License

Released under the MIT License. Attribution to [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) is preserved above, as required by its MIT terms.
