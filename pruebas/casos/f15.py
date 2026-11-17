# -*- coding: utf-8 -*-
"""Quirón Codex 0.10: widgets flotantes, captura rápida y sincronización entre ventanas."""
import threading, http.server, socketserver, functools, time, json, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
srv = Q(('127.0.0.1', 4191), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(g.result ? (typeof g.result === 'string' ? JSON.parse(g.result) : g.result) : null); }; })"""
URL = 'http://127.0.0.1:4191/'

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 920})
    main = ctx.new_page()
    for pg in (main,):
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    main.add_init_script("if(!localStorage.getItem('alq:settings')) localStorage.setItem('alq:settings', JSON.stringify({view:'study'}))")
    main.goto(URL); main.wait_for_selector('.rail')

    # ---------- 1. La ventana principal no es un widget ----------
    ok('la app normal no se dibuja como widget', main.locator('.wg').count() == 0 and main.locator('.rail').count() == 1)

    # ---------- 2. Cápsula de estudio ----------
    w = ctx.new_page()
    w.on('pageerror', lambda e: errs.append('widget: ' + str(e)))
    w.on('console', lambda m: errs.append('widget: ' + m.text) if m.type == 'error' else None)
    w.goto(URL + '?widget=glance'); w.wait_for_selector('.wg')
    ok('la cápsula se abre sin la app completa', w.locator('.wg').count() == 1 and w.locator('.rail').count() == 0)
    ok('marca el documento como widget', w.evaluate("() => document.documentElement.dataset.widget") == 'glance')
    ok('trae barra para arrastrar y cerrar', w.locator('.wg-bar[data-tauri-drag-region]').count() == 1 and w.locator('.wg-x').count() == 1)
    txt = w.inner_text('.wg')
    ok('muestra hora y minutos de estudio', 'min hoy' in txt and ':' in txt, txt[:80].replace('\n', ' | '))

    # ---------- 3. Captura rápida ----------
    cap = ctx.new_page()
    cap.on('pageerror', lambda e: errs.append('captura: ' + str(e)))
    cap.goto(URL + '?widget=capture'); cap.wait_for_selector('.wg-seg')
    ok('la captura ofrece perla, nota y flashcard', cap.locator('.wg-seg button').count() == 3, cap.locator('.wg-seg button').all_inner_texts())
    cap.fill('.wg-input', 'Tríada de Whipple: hipoglucemia, síntomas y mejoría con glucosa')
    cap.click('.wg-btn:has-text("Guardar")'); time.sleep(1.2)
    ok('avisa que guardó', 'guardada' in cap.inner_text('.wg-ok').lower(), cap.inner_text('.wg-body')[-60:])
    hy = cap.evaluate(KV, 'hy')
    ok('la perla queda guardada', any('Whipple' in i['text'] for i in hy['items']), [i['title'] for i in hy['items'][:3]])

    # ---------- 4. Sincronización entre ventanas, sin recargar ----------
    # «Perlas HY» es una vista de la barra lateral (puede estar dentro del menú «Más»).
    if main.locator('.rail-btn:has-text("Perlas HY")').count():
        main.click('.rail-btn:has-text("Perlas HY")')
    else:
        main.click('.rail-btn:has-text("Más")'); main.click('.rail-pop button:has-text("Perlas HY")')
    main.wait_for_selector('.page', timeout=8000); time.sleep(0.8)
    ok('la app ve la perla capturada antes', 'Whipple' in main.inner_text('body'), main.inner_text('body')[:80].replace('\n', ' | '))

    cap.fill('.wg-input', 'Signo de Murphy: dolor al inspirar con presión subcostal')
    cap.click('.wg-btn:has-text("Guardar")')
    live = main.evaluate("""() => new Promise(r => {
        const t0 = Date.now();
        const tick = () => {
          if (document.body.innerText.includes('Murphy')) return r(true);
          if (Date.now() - t0 > 8000) return r(false);
          setTimeout(tick, 200);
        };
        tick();
      })""")
    ok('lo capturado aparece en la app sin recargar', live is True)

    # ---------- 5. Widget de pendientes ----------
    main.evaluate("""() => localStorage.setItem('qc:ward', JSON.stringify({ patients: [{ id:'p1', bed:'302', sex:'', age:'', weight:'', topicId:null, dx:'', note:'', createdAt: Date.now(), tasks:[{id:'t1', text:'BH de control', kind:'lab', done:false, at:'06:00'}] }], endsAt: Date.now() + 3600000 }))""")
    ward = ctx.new_page()
    ward.goto(URL + '?widget=ward'); ward.wait_for_selector('.wg')
    time.sleep(0.8)
    ok('el widget del turno lista los pendientes', 'BH de control' in ward.inner_text('.wg') and '302' in ward.inner_text('.wg'), ward.inner_text('.wg-body')[:80].replace('\n', ' | '))
    # Al revés: se marca hecho en el widget y la app lo refleja sin recargar.
    ward.click('.wg-check')
    gone = ward.evaluate("() => new Promise(r => { const t0 = Date.now(); const tick = () => { if (!document.body.innerText.includes('BH de control')) return r(true); if (Date.now() - t0 > 6000) return r(false); setTimeout(tick, 200); }; tick(); })")
    ok('marcar en el widget lo quita de la lista', gone is True)
    main.click('.rail-btn:has-text("Turno")'); main.wait_for_selector('.ward-page', timeout=8000); time.sleep(1.0)
    done_in_app = main.evaluate("() => { const w = JSON.parse(localStorage.getItem('qc:ward') || '{}'); return w.patients?.[0]?.tasks?.[0]?.done === true; }")
    ok('la app recibe el cambio del widget', done_in_app is True)

    # ---------- 6. Repaso ----------
    rev = ctx.new_page()
    rev.goto(URL + '?widget=review'); rev.wait_for_selector('.wg')
    ok('el widget de repaso dice cuántas tocan', 'repasar' in rev.inner_text('.wg').lower(), rev.inner_text('.wg-body')[:60].replace('\n', ' | '))

    # ---------- 7. En la web se explica que son de escritorio ----------
    main.click('.rail-btn:has-text("Herramientas")'); main.click('.rail-pop button:has-text("Widgets")')
    main.wait_for_selector('.modal:has-text("Widgets")')
    ok('en el navegador avisa que son de la app de escritorio', 'escritorio' in main.inner_text('.modal').lower(), main.inner_text('.modal')[:110].replace('\n', ' | '))

    errs2 = [e for e in errs if 'favicon' not in e and 'Failed to load resource' not in e]
    ok('sin errores de consola', not errs2, errs2[:3])
    b.close()
srv.shutdown()
print(f'SUMMARY {sum(1 for v in res.values() if v)} / {len(res)}')
