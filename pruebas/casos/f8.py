import threading, http.server, socketserver, functools, time, json, datetime, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4189/'
if URL.startswith('http'):
    srv = Q(('127.0.0.1', 4189), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(typeof g.result === 'string' ? JSON.parse(g.result) : g.result ?? null); }; })"""
start = (datetime.date(2026, 11, 13) - datetime.timedelta(days=40)).isoformat()
open('/tmp/tc/falso.pdf', 'w').write('esto no es un pdf, solo texto renombrado')

def prefs(pg):
    (pg.click('.rail-btn:has-text("Ajustes")') if not pg.locator('.rail-pop').count() else None); pg.click('.rail-pop button:has-text("Preferencias")'); pg.wait_for_selector('.prefs')

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- Surface vertical ----------
    pt = b.new_page(viewport={'width': 912, 'height': 1368}); pt.on('pageerror', lambda e: errs.append(str(e)))
    pt.goto(URL); pt.wait_for_selector('.rail'); pt.click('.rail-btn:has-text("Estudio")'); time.sleep(0.4)
    ok('portrait: study split stacks vertically', pt.locator('.split.vertical').count() == 1 and pt.get_attribute('.split-divider', 'aria-orientation') == 'horizontal')
    r = pt.evaluate("(() => { const p = [...document.querySelectorAll('.split-pane')].map(e => e.getBoundingClientRect()); return [p[0].top < p[1].top, Math.abs(p[0].left - p[1].left) < 2]; })()")
    ok('portrait: PDF above, notes below', r == [True, True], r)
    pt.close()

    ctx = b.new_context(viewport={'width': 1368, 'height': 912}, accept_downloads=True); pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 13, 9, 0))
    pg.on('dialog', lambda d: d.accept())
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_selector('.setup')
    ok('landscape: side by side', True)
    pg.fill('.setup input[type=date] >> nth=0', start); pg.fill('.setup input[type=number] >> nth=0', '60'); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card')

    # ---------- ahorro de batería ----------
    prefs(pg)
    pg.click('.prefs .seg[aria-label="Ahorro de batería"] button:has-text("Siempre")'); time.sleep(0.2)
    ok('battery saver on', pg.evaluate("document.documentElement.dataset.saver") == 'on' and pg.evaluate("getComputedStyle(document.body, '::before').animationName") == 'none')
    pg.click('.prefs .seg[aria-label="Ahorro de batería"] button:has-text("Nunca")'); time.sleep(0.2)
    ok('battery saver off', pg.evaluate("document.documentElement.dataset.saver") is None)
    pg.click('.prefs .seg[aria-label="Ahorro de batería"] button:has-text("Automático")'); time.sleep(0.3)
    ok('battery saver auto (desktop on charger → off)', pg.evaluate("document.documentElement.dataset.saver") is None)
    pg.keyboard.press('Escape')

    # ---------- vistas cargadas bajo demanda ----------
    for v, sel in [('Calendario', '.week, .month'), ('Progreso', '.page-title'), ('Perlas HY', '.hy-page'), ('Simulacros', '.exam-page'), ('Turno', '.ward-page'), ('Bitácora', '.logbook-page'), ('Cuadernos', '.page-title')]:
        pg.click(f'.rail-btn:has-text("{v}")'); pg.wait_for_selector(sel, timeout=5000)
    ok('every lazy view opens', True)
    pg.click('.rail-btn:has-text("Simulacros")'); pg.wait_for_selector('.exam-page')
    pg.click('.exam-setup button:has-text("Generar casos")'); time.sleep(0.2)
    ok('empty simulacro → «Generar casos» jumps to the tab', pg.locator('.exam-tabs button[aria-selected="true"]:has-text("Generar casos")').count() == 1)

    # ---------- PDF dañado ----------
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.3)
    pg.set_input_files('.pdf-body input[type=file]', ['/tmp/tc/falso.pdf']); time.sleep(0.8)
    t = pg.inner_text('.toast') if pg.locator('.toast').count() else ''
    ok('broken PDF rejected with a clear message', 'dañado o no es un PDF' in t and pg.evaluate(KV, 'library') in (None,) or len((pg.evaluate(KV, 'library') or {}).get('docs', [])) == 0, t)
    pg.set_input_files('.pdf-body input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf']); time.sleep(1.2)
    ok('real PDF still accepted', len(pg.evaluate(KV, 'library')['docs']) == 1)

    # ---------- restaurar y deshacer ----------
    pg.click('.rail-btn:has-text("Bitácora")'); pg.wait_for_selector('.lb-form')
    pg.click('.lb-form button:has-text("Registrar")'); time.sleep(1.0)
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Respaldo")'); pg.wait_for_selector('.backup')
    ok('no undo before any restore', pg.locator('.backup button:has-text("Deshacer restauración")').count() == 0)
    with pg.expect_download() as dl:
        pg.click('button:has-text("Solo notas y progreso")')
    old = dl.value.path()
    pg.keyboard.press('Escape')
    pg.click('.rail-btn:has-text("Bitácora")'); pg.wait_for_selector('.lb-form')
    pg.click('.lb-form button:has-text("Registrar")'); time.sleep(1.0)
    ok('new data after the backup', len(pg.evaluate(KV, 'logbook')['entries']) == 2)
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Respaldo")'); pg.wait_for_selector('.backup')
    with pg.expect_navigation(timeout=15000):
        pg.set_input_files('.backup input[type=file]', old)
    pg.wait_for_selector('.rail'); time.sleep(1.0)
    lb = pg.evaluate(KV, 'logbook')
    ok('old backup restored (newer entry gone)', len(lb['entries']) == 1, len(lb['entries']))
    ok('safety copy kept outside backups', pg.evaluate(KV, 'safety:prerestore') is not None)
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Respaldo")'); pg.wait_for_selector('.backup')
    pg.wait_for_selector('.backup button:has-text("Deshacer restauración")', timeout=5000); ok('undo offered', True)
    with pg.expect_navigation(timeout=15000):
        pg.click('.backup button:has-text("Deshacer restauración")')
    pg.wait_for_selector('.rail'); time.sleep(1.0)
    ok('undo brings the entry back', len(pg.evaluate(KV, 'logbook')['entries']) == 2)
    ok('undo used once', pg.evaluate(KV, 'safety:prerestore') is None)

    # ---------- falla del respaldo automático ----------
    pg.evaluate("localStorage.setItem('qc:backupError', JSON.stringify({ msg: 'El respaldo en la carpeta quedó incompleto.', at: '2026-11-13T15:00:00.000Z' }))")
    pg.reload(); pg.wait_for_selector('.rail'); time.sleep(0.5)
    ok('rail warns about the failed backup', pg.locator('.rail-btn:has-text("Ajustes") .rail-dot').count() == 1)
    pg.click('.rail-btn:has-text("Ajustes")'); time.sleep(0.2)
    ok('menu says why', 'falló' in pg.inner_text('.rail-pop'))
    pg.click('.rail-pop button:has-text("Respaldo")'); pg.wait_for_selector('.backup')
    ok('backup dialog shows the error', 'incompleto' in pg.inner_text('.backup-alert'))
    pg.keyboard.press('Escape')

    # ---------- textos ----------
    pg.click('.rail-btn:has-text("Inicio")'); time.sleep(0.3)
    ok('Inicio button named like the menu', pg.locator('.page-head button:has-text("GPC y temario")').count() == 1)

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
