/* ============================================================
   QR Code Generator
   ============================================================ */

(function () {
  'use strict';

  // The library defaults to Latin-1, which mangles non-Latin text.
  if (window.qrcode && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  /* ---------- Elements ---------- */

  var el = {
    html: document.documentElement,
    text: document.getElementById('qrText'),
    charCount: document.getElementById('charCount'),
    size: document.getElementById('qrSize'),
    sizeValue: document.getElementById('sizeValue'),
    ec: document.getElementById('ecLevel'),
    fgColor: document.getElementById('fgColor'),
    fgHex: document.getElementById('fgHex'),
    bgColor: document.getElementById('bgColor'),
    bgHex: document.getElementById('bgHex'),
    contrastHint: document.getElementById('contrastHint'),
    download: document.getElementById('downloadBtn'),
    copy: document.getElementById('copyBtn'),
    reset: document.getElementById('resetBtn'),
    canvas: document.getElementById('qrCanvas'),
    placeholder: document.getElementById('placeholder'),
    meta: document.getElementById('metaBadge'),
    status: document.getElementById('status'),
    themeToggle: document.getElementById('themeToggle')
  };

  var DEFAULT_FG = '#101418';
  var DEFAULT_BG = '#ffffff';

  var statusTimer = null;

  /* ============================================================
     Theme
     ============================================================ */

  function applyTheme(theme) {
    el.html.setAttribute('data-theme', theme);
    try { localStorage.setItem('qr-theme', theme); } catch (e) {}
    el.themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  el.themeToggle.addEventListener('click', function () {
    applyTheme(el.html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  applyTheme(el.html.getAttribute('data-theme') || 'light');

  /* ============================================================
     Status messages
     ============================================================ */

  function setStatus(message, kind) {
    clearTimeout(statusTimer);
    el.status.textContent = message;
    el.status.className = 'status' + (kind ? ' is-' + kind : '');
    if (kind === 'success') {
      statusTimer = setTimeout(function () {
        el.status.textContent = '';
        el.status.className = 'status';
      }, 2200);
    }
  }

  /* ============================================================
     Color helpers
     ============================================================ */

  var HEX_RE = /^#[0-9a-fA-F]{6}$/;

  function normalizeHex(value) {
    var v = String(value).trim();
    if (v && v.charAt(0) !== '#') v = '#' + v;
    return HEX_RE.test(v) ? v.toLowerCase() : null;
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function luminance(hex) {
    var c = hexToRgb(hex);
    var ch = [c.r, c.g, c.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  function contrastRatio(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    var hi = Math.max(la, lb);
    var lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function updateContrastHint() {
    var fg = normalizeHex(el.fgHex.value);
    var bg = normalizeHex(el.bgHex.value);
    if (!fg || !bg) return;

    var ratio = contrastRatio(fg, bg);
    if (ratio < 3) {
      el.contrastHint.textContent =
        'Very low contrast (' + ratio.toFixed(1) + ':1) — this code probably won\'t scan.';
      el.contrastHint.classList.add('is-warning');
    } else if (ratio < 4.5) {
      el.contrastHint.textContent =
        'Moderate contrast (' + ratio.toFixed(1) + ':1) — test a scan before printing.';
      el.contrastHint.classList.remove('is-warning');
    } else {
      el.contrastHint.textContent =
        'Good contrast (' + ratio.toFixed(1) + ':1). Keep it above 3:1 to stay scannable.';
      el.contrastHint.classList.remove('is-warning');
    }
  }

  /* ============================================================
     QR rendering
     ============================================================ */

  function currentColors() {
    return {
      fg: normalizeHex(el.fgHex.value) || DEFAULT_FG,
      bg: normalizeHex(el.bgHex.value) || DEFAULT_BG
    };
  }

  /**
   * Paint the QR matrix onto a canvas at device resolution.
   * Module boundaries are rounded to integers so adjacent modules
   * share exact pixel edges — no anti-aliased hairline seams.
   */
  function paint(canvas, qr, sizePx, dpr, fg, bg) {
    var count = qr.getModuleCount();
    var dim = Math.max(1, Math.round(sizePx * dpr));

    canvas.width = dim;
    canvas.height = dim;
    canvas.style.width = sizePx + 'px';

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, dim, dim);

    var cell = dim / count;
    ctx.fillStyle = fg;

    for (var row = 0; row < count; row++) {
      var y0 = Math.round(row * cell);
      var y1 = Math.round((row + 1) * cell);
      for (var col = 0; col < count; col++) {
        if (!qr.isDark(row, col)) continue;
        var x0 = Math.round(col * cell);
        var x1 = Math.round((col + 1) * cell);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }

    return count;
  }

  function buildQR(text, ecLevel) {
    var qr = qrcode(0, ecLevel); // 0 = pick the smallest version that fits
    qr.addData(text);
    qr.make();
    return qr;
  }

  function hasContent() {
    return el.text.value.trim().length > 0;
  }

  function render() {
    var size = parseInt(el.size.value, 10);
    el.sizeValue.textContent = size + ' px';
    // Count code points, not UTF-16 units, so an emoji reads as 1.
    el.charCount.textContent = Array.from(el.text.value).length;
    updateContrastHint();

    if (!hasContent()) {
      el.canvas.hidden = true;
      el.placeholder.hidden = false;
      el.meta.hidden = true;
      el.download.disabled = true;
      el.copy.disabled = true;
      setStatus('');
      return;
    }

    try {
      var colors = currentColors();
      var qr = buildQR(el.text.value, el.ec.value);
      var count = paint(el.canvas, qr, size, window.devicePixelRatio || 1,
                        colors.fg, colors.bg);

      el.canvas.hidden = false;
      el.placeholder.hidden = true;
      el.canvas.setAttribute('aria-label', 'QR code for: ' + el.text.value.trim().slice(0, 120));
      el.meta.hidden = false;
      el.meta.textContent = size + ' px · ' + count + '×' + count;
      el.download.disabled = false;
      el.copy.disabled = false;
      setStatus('');
    } catch (err) {
      showCapacityError(err);
    }
  }

  function showCapacityError(err) {
    var message = String(err && err.message || err);
    var friendly = /code length overflow/i.test(message)
      ? 'Too much text for this error level. Shorten it, or drop error correction to L.'
      : 'Couldn\'t generate that code: ' + message;

    el.canvas.hidden = true;
    el.placeholder.hidden = false;
    el.meta.hidden = true;
    el.download.disabled = true;
    el.copy.disabled = true;
    setStatus(friendly, 'error');
  }

  /* ---------- Debounced live preview ---------- */

  var debounceTimer = null;

  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 150);
  }

  el.text.addEventListener('input', scheduleRender);

  [el.size, el.ec].forEach(function (node) {
    node.addEventListener('input', render);
    node.addEventListener('change', render);
  });

  /* ============================================================
     Color controls
     ============================================================ */

  function bindColor(colorInput, hexInput) {
    colorInput.addEventListener('input', function () {
      hexInput.value = colorInput.value.toLowerCase();
      render();
    });

    hexInput.addEventListener('input', function () {
      var hex = normalizeHex(hexInput.value);
      if (hex) {
        colorInput.value = hex;
        render();
      }
    });

    // Let people finish typing a partial hex, then normalize on blur.
    hexInput.addEventListener('blur', function () {
      var hex = normalizeHex(hexInput.value);
      hexInput.value = hex || colorInput.value;
      updateContrastHint();
    });
  }

  bindColor(el.fgColor, el.fgHex);
  bindColor(el.bgColor, el.bgHex);

  el.reset.addEventListener('click', function () {
    el.fgColor.value = DEFAULT_FG;
    el.fgHex.value = DEFAULT_FG;
    el.bgColor.value = DEFAULT_BG;
    el.bgHex.value = DEFAULT_BG;
    render();
    setStatus('Colors reset.', 'success');
  });

  /* ============================================================
     Download & copy
     ============================================================ */

  function toBlob() {
    return new Promise(function (resolve, reject) {
      el.canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error('Canvas export failed'));
      }, 'image/png');
    });
  }

  function fileName() {
    var text = el.text.value.trim().slice(0, 40).replace(/[^a-z0-9]+/gi, '-');
    return 'qr-' + (text.replace(/^-+|-+$/g, '') || 'code') + '.png';
  }

  el.download.addEventListener('click', function () {
    if (el.download.disabled) return;
    toBlob().then(function (blob) {
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = fileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      setStatus('Downloaded ' + fileName(), 'success');
    }).catch(function (err) {
      setStatus('Download failed: ' + err.message, 'error');
    });
  });

  el.copy.addEventListener('click', function () {
    if (el.copy.disabled) return;

    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
      setStatus('Copying images isn\'t supported in this browser — use Download PNG.', 'error');
      return;
    }

    // Passing a Promise<ClipboardItem> is what Safari requires; Chrome accepts it too.
    var item;
    try {
      item = new ClipboardItem({ 'image/png': toBlob() });
    } catch (err) {
      setStatus('Copying images isn\'t supported in this browser — use Download PNG.', 'error');
      return;
    }

    navigator.clipboard.write([item]).then(function () {
      setStatus('Copied to clipboard.', 'success');
    }).catch(function (err) {
      setStatus(
        err && err.name === 'NotAllowedError'
          ? 'Clipboard access was blocked — allow it in your browser settings.'
          : 'Copy failed: ' + (err && err.message || err),
        'error'
      );
    });
  });

  /* ============================================================
     Init
     ============================================================ */

  render();
})();
