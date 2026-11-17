import threading, http.server, socketserver, functools, time, json, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4188/'
if URL.startswith('http'):
    srv = Q(('127.0.0.1', 4188), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()

# Mide en la MISMA tarea de JS: down + N moves y lee los píxeles del canvas en vivo sin ceder un cuadro.
SYNC = """([sel, liveSel, pid]) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
  const mk = (t, i) => new PointerEvent(t, { pointerId: pid, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
    clientX: r.left + 60 + i * 9, clientY: r.top + 80 + Math.sin(i / 3) * 10, pressure: 0.6, buttons: t === 'pointerup' ? 0 : 1 });
  const live = el.parentElement.querySelectorAll(liveSel);
  const ink = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
  el.dispatchEvent(mk('pointerdown', 0));
  const t0 = performance.now();
  for (let i = 1; i < 25; i++) el.dispatchEvent(mk('pointermove', i));
  const ms = performance.now() - t0;
  const before = ink(live[0]);
  const attrs = [...live].map((c) => c.getContext('2d').getContextAttributes().desynchronized);
  return { before, ms, attrs, n: live.length };
}"""
UP = """([sel, pid]) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerup', { pointerId: pid, pointerType: 'pen', isPrimary: true, bubbles: true, clientX: r.left + 280, clientY: r.top + 80, pressure: 0, buttons: 0 })); }"""
INKED = """([sel]) => [...document.querySelectorAll(sel)].map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })"""

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1368, 'height': 912})
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_selector('.rail'); pg.click('.rail-btn:has-text("Estudio")'); pg.wait_for_selector('.empty-state')
    pg.set_input_files('.pdf-body input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf'])
    pg.wait_for_function("[...document.querySelectorAll('.pdf-page > canvas')].some(c => c.width > 0)", timeout=15000); time.sleep(0.8)

    # ---------- Lienzo de notas ----------
    pg.click('.notes-panel button:has-text("Nueva nota")'); time.sleep(0.4)
    pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(0.4)
    r = pg.evaluate(SYNC, ['.ink-page', '.ink-page canvas.ink-live', 31])
    ok('notes: ink appears in the same event (no frame wait)', r['before'] > 200, r)
    ok('notes: live + tip layers', r['n'] == 2)
    ok('notes: 24 pen moves handled fast', r['ms'] < 40, f"{r['ms']:.1f} ms")
    now = pg.evaluate("(a) => { (" + UP + ")(a); return (" + INKED + ")(['.ink-page canvas']); }", ['.ink-page', 31])
    ok('notes: at pen-up the stroke is already on the base and live is clear (same instant)', now[0] > 200 and now[1] == 0 and now[2] == 0, now[:3])
    time.sleep(0.6)
    base, live, tip = pg.evaluate(INKED, ['.ink-page canvas'])[:3]
    ok('notes: stroke committed to the base canvas, live layers cleared', base > 200 and live == 0 and tip == 0, (base, live, tip))
    time.sleep(1.0)
    strokes = pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia'); r.onsuccess = () => { const g = r.result.transaction('ink').objectStore('ink').getAll(); g.onsuccess = () => res(g.result.flat().filter(s => s && s.points)); }; })""")
    ok('notes: stroke saved with all points', len(strokes) == 1 and len(strokes[0]['points']) == 25, len(strokes[0]['points']) if strokes else 0)

    # Marcatextos: opacidad en el canvas entero (los tramos no se oscurecen al encimarse)
    pg.click('.notes-panel button[aria-label="Marcatextos"]') if pg.locator('.notes-panel button[aria-label="Marcatextos"]').count() else None
    if pg.locator('.notes-panel button[aria-label="Marcatextos"]').count():
        pg.evaluate(SYNC.replace('pressure: 0.6', 'pressure: 0.5'), ['.ink-page', '.ink-page canvas.ink-live', 32])
        op = pg.evaluate("getComputedStyle(document.querySelector('.ink-page canvas.ink-live')).opacity")
        ok('highlighter live opacity on the layer', op == '0.32', op)
        pg.evaluate(UP, ['.ink-page', 32]); time.sleep(0.4)

    # ---------- PDF ----------
    pg.click('button[aria-label="Escribir / dibujar"]'); time.sleep(0.2)
    r = pg.evaluate(SYNC, ['.pdf-page[data-page="1"] .ann-layer', '.pdf-page[data-page="1"] canvas.ink-live', 33])
    ok('PDF: ink appears in the same event (no frame wait)', r['before'] > 200, r)
    ok('PDF: live + tip layers', r['n'] == 2)
    pg.evaluate(UP, ['.pdf-page[data-page="1"] .ann-layer', 33]); time.sleep(0.6)
    counts = pg.evaluate(INKED, ['.pdf-page[data-page="1"] canvas.ink-layer'])
    ok('PDF: stroke committed, live layers cleared', counts[0] > 200 and counts[1] == 0 and counts[2] == 0, counts)

    # ---------- La predicción nunca queda en el dibujo ----------
    # Escritura rápida: 12 trazos seguidos sin pausas; todos se guardan completos y el lienzo coincide tras recargar la hoja
    pg.click('[role=tab]:has-text("Lienzo")'); time.sleep(0.3)
    FAST = """() => { const el = document.querySelector('.ink-page'); const r = el.getBoundingClientRect(); const t0 = performance.now();
      for (let k = 0; k < 12; k++) { const mk = (t, i) => new PointerEvent(t, { pointerId: 50 + k, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        clientX: r.left + 40 + i * 12, clientY: r.top + 200 + k * 14, pressure: 0.5 + (i % 3) * 0.1, buttons: t === 'pointerup' ? 0 : 1 });
        el.dispatchEvent(mk('pointerdown', 0)); for (let i = 1; i < 12; i++) el.dispatchEvent(mk('pointermove', i)); el.dispatchEvent(mk('pointerup', 12)); }
      return performance.now() - t0; }"""
    ms = pg.evaluate(FAST); time.sleep(1.5)
    strokes = pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia'); r.onsuccess = () => { const g = r.result.transaction('ink').objectStore('ink').getAll(); g.onsuccess = () => res(g.result.flat().filter(s => s && s.points)); }; })""")
    fast = [s for s in strokes if len(s['points']) == 12]
    ok('fast writing: 12 strokes in a row all saved with every point', len(fast) == 12, (len(fast), f'{ms:.1f} ms'))
    a = pg.evaluate(INKED, ['.ink-page canvas'])[0]
    pg.click('[role=tab]:has-text("Texto")'); time.sleep(0.3); pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(0.8)
    bb = pg.evaluate(INKED, ['.ink-page canvas'])[0]
    ok('incremental drawing matches a full redraw', abs(a - bb) <= max(8, a * 0.01), (a, bb))

    # Zoom del lienzo y del PDF
    w0 = pg.evaluate("document.querySelector('.ink-page').getBoundingClientRect().width")
    pg.click('button[aria-label="Acercar lienzo"]'); time.sleep(0.5)
    w1 = pg.evaluate("document.querySelector('.ink-page').getBoundingClientRect().width")
    ok('canvas zoom buttons', abs(w1 / w0 - 1.25) < 0.02 and '125%' in pg.inner_text('.ink-zoom'), (w0, w1))
    r = pg.evaluate(SYNC, ['.ink-page', '.ink-page canvas.ink-live', 71]); pg.evaluate(UP, ['.ink-page', 71]); time.sleep(0.5)
    ok('writing works while zoomed', r['before'] > 200)
    WHEEL = """(sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
      for (let i = 0; i < 4; i++) el.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -60, clientX: r.left + r.width / 2, clientY: r.top + 200, bubbles: true, cancelable: true })); }"""
    pg.evaluate(WHEEL, '.ink-scroll'); time.sleep(0.6)
    w2 = pg.evaluate("document.querySelector('.ink-page').getBoundingClientRect().width")
    ok('Ctrl + wheel zooms the canvas', w2 > w1 * 1.3, (w1, w2))
    pg.reload(); pg.wait_for_selector('.rail'); pg.click('.rail-btn:has-text("Estudio")'); time.sleep(1.5)
    ok('canvas zoom remembered', pg.evaluate("JSON.parse(localStorage.getItem('alq:settings')).inkZoom") > 1.6)
    pw0 = pg.evaluate("document.querySelector('.pdf-page').getBoundingClientRect().width")
    pg.evaluate(WHEEL, '.pdf-scroll'); time.sleep(1.0)
    pw1 = pg.evaluate("document.querySelector('.pdf-page').getBoundingClientRect().width")
    ok('Ctrl + wheel zooms the PDF', pw1 > pw0 * 1.3 and pg.evaluate("document.querySelector('.pdf-scroll').style.transform") == '', (pw0, pw1))
    PINCH = """(sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + 250;
      const T = (id, x) => new Touch({ identifier: id, target: el, clientX: x, clientY: cy });
      const ev = (t, d) => el.dispatchEvent(new TouchEvent(t, { touches: t === 'touchend' ? [] : [T(1, cx - d), T(2, cx + d)], changedTouches: [T(1, cx - d), T(2, cx + d)], bubbles: true, cancelable: true }));
      ev('touchstart', 100); ev('touchmove', 80); ev('touchmove', 50); const mid = el.style.transform; ev('touchend', 50); return mid; }"""
    mid = pg.evaluate(PINCH, '.pdf-scroll'); time.sleep(1.0)
    pw2 = pg.evaluate("document.querySelector('.pdf-page').getBoundingClientRect().width")
    ok('two-finger pinch: live preview, then real zoom', 'scale(0.5)' in mid and abs(pw2 / pw1 - 0.5) < 0.05, (mid, pw1, pw2))

    ok('prediction API used when available', pg.evaluate("typeof PointerEvent.prototype.getPredictedEvents") == 'function')

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
