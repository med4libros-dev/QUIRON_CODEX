# -*- coding: utf-8 -*-
"""Quirón Codex 0.9: doble plana, barra flotante, hojas, FSRS, historial, temario y espacio."""
import threading, http.server, socketserver, functools, time, json, sys
from playwright.sync_api import sync_playwright

def abrir_hoja(pg):
    """Los controles de hoja viven tras el botón «Hoja» desde la 0.26."""
    if pg.locator('.hoja-pop').count() == 0:
        pg.click('.ink-toolbar button:has-text("Hoja")')
        pg.wait_for_selector('.hoja-pop')


http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
srv = Q(('127.0.0.1', 4192), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs, calls = {}, [], []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(g.result ? (typeof g.result === 'string' ? JSON.parse(g.result) : g.result) : null); }; })"""

def claude(route):
    calls.append(json.loads(route.request.post_data or '{}'))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': [{'type': 'text', 'text': 'Bronquiolitis: lactante con sibilancias'}]}))

def pen(pg, sel, fx0, fy0, fx1, fy1, pid=51):
    pg.evaluate(f"""() => {{ const el = document.querySelector('{sel}'); const r = el.getBoundingClientRect();
      const P = (t, fx, fy) => el.dispatchEvent(new PointerEvent(t, {{ pointerId: {pid}, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, pressure: t === 'pointerup' ? 0 : 0.5, buttons: t === 'pointerup' ? 0 : 1 }}));
      P('pointerdown', {fx0}, {fy0}); for (let i = 1; i <= 12; i++) P('pointermove', {fx0} + ({fx1}-{fx0})*i/12, {fy0} + ({fy1}-{fy0})*i/12); P('pointerup', {fx1}, {fy1}); }}""")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 920}, accept_downloads=True)
    pg = ctx.new_page()
    pg.route('https://api.anthropic.com/**', claude)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: d.accept())
    pg.add_init_script("if(!localStorage.getItem('alq:settings')) localStorage.setItem('alq:settings', JSON.stringify({view:'study', apiKey:'sk-ant-test', model:'claude-sonnet-5-5', aiProvider:'claude'}))")
    pg.goto('http://127.0.0.1:4192/'); pg.wait_for_selector('.empty-state')
    pg.set_input_files('.pdf-body input[type=file]', '/tmp/tc/test.pdf')
    pg.wait_for_selector('.pdf-page canvas'); time.sleep(1.2)

    # ---------- 1. Doble plana ----------
    box = lambda i: pg.evaluate(f"() => {{ const e = document.querySelectorAll('.pdf-page')[{i}]; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; }}")
    w1 = box(0)[2]
    pg.click('.toolbar .icon-btn[title^="Doble plana"]'); time.sleep(1.8)
    a, c = box(0), box(1)
    ok('doble plana: dos páginas en el mismo renglón', a[1] == c[1] and a[0] < c[0], (a, c))
    ok('doble plana: cada página a la mitad', a[2] < w1 * 0.6, (w1, a[2]))
    pg.click('.toolbar .icon-btn[title^="Una página"]'); time.sleep(1.5)
    ok('vuelve a una página', box(0)[1] != box(1)[1])

    # ---------- 2. Barra flotante en pantalla completa ----------
    pg.click('button[data-more-toggle]'); pg.click('.more-menu button:has-text("Pantalla completa")'); time.sleep(1.2)
    ok('la barra flotante aparece', pg.locator('.focus-bar').count() == 1)
    ok('empieza atenuada', float(pg.evaluate("() => getComputedStyle(document.querySelector('.focus-bar')).opacity")) < 0.3)
    pg.mouse.move(700, 18); time.sleep(0.5)
    ok('se enciende al acercarse al borde', pg.get_attribute('.focus-bar', 'data-near') == '1' and float(pg.evaluate("() => getComputedStyle(document.querySelector('.focus-bar')).opacity")) > 0.9)
    pg.fill('.focus-bar .page-input', '9'); pg.keyboard.press('Enter'); time.sleep(1.4)
    ok('salta de página desde la barra flotante', pg.input_value('.focus-bar .page-input') == '9')
    pg.click('.focus-bar .icon-btn[title^="Buscar"]'); time.sleep(0.4)
    ok('abre la búsqueda desde la barra flotante', pg.locator('.find-bar').count() == 1)
    pg.keyboard.press('Escape'); time.sleep(0.3)
    pg.keyboard.press('Escape'); time.sleep(0.6)
    ok('Esc sale de pantalla completa', pg.locator('.focus-bar').count() == 0 and pg.locator('.rail').is_visible())
    wmain = pg.evaluate("() => Math.round(document.querySelector('.pdf-scroll').getBoundingClientRect().width)")
    ok('el lector conserva su ancho al salir', wmain > 300, wmain)

    # ---------- 3. Hojas del lienzo ----------
    pg.click('.notes-panel .btn.primary:has-text("Nueva nota")'); pg.wait_for_selector('.editor')
    pg.click('.notes-panel [role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas')
    pen(pg, '.ink-page', 0.15, 0.15, 0.6, 0.2)
    time.sleep(1.5)
    ok('hojas continuas: la segunda sale sola al escribir en la última', pg.locator('.ink-sheet').count() >= 2, pg.locator('.ink-sheet').count())
    pg.evaluate("""() => { const el = document.querySelectorAll('.ink-sheet .ink-page')[1]; const r = el.getBoundingClientRect();
      const P = (t, fx, fy) => el.dispatchEvent(new PointerEvent(t, { pointerId: 52, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, pressure: t === 'pointerup' ? 0 : 0.5, buttons: t === 'pointerup' ? 0 : 1 }));
      el.scrollIntoView({ block: 'center' });
      P('pointerdown', 0.2, 0.6); for (let i = 1; i <= 12; i++) P('pointermove', 0.2 + 0.5*i/12, 0.6 + 0.05*i/12); P('pointerup', 0.7, 0.65); }""")
    time.sleep(1.6)
    sheets = pg.locator('.ink-sheet').count()
    ok('dos hojas con trazos', sheets >= 2, sheets)
    abrir_hoja(pg)
    ok('once estilos de hoja', pg.locator('.hoja-pop select[aria-label="Tipo de hoja"] option').count() == 11, pg.locator('.hoja-pop select[aria-label="Tipo de hoja"] option').count())
    pg.keyboard.press('Escape'); time.sleep(0.3)
    pg.click('.ink-toolbar button:has-text("Organizar")'); pg.wait_for_selector('.sheet-grid')
    pg.wait_for_selector('.sheet-thumb img', timeout=8000)
    ok('miniaturas de las dos hojas', pg.locator('.sheet-thumb img').count() == 2, pg.locator('.sheet-thumb img').count())
    ok('cada hoja muestra cuánto tiene', '1' in pg.inner_text('.sheet-foot'))
    # fusionar la 2 con la 1
    pg.locator('.sheet-card').nth(1).locator('.icon-btn[title^="Fusionar"]').click(); time.sleep(1.6)
    ok('fusionar deja una sola hoja', pg.locator('.ink-sheet').count() == sheets - 1, pg.locator('.ink-sheet').count())
    ink = pg.evaluate("""() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const t = q.result.transaction('ink').objectStore('ink'); const g = t.getAll(); g.onsuccess = () => r(g.result.flat().filter(x => x && x.points)); }; })""")
    ok('la fusión conserva los dos trazos en la hoja 1', len(ink) >= 2 and all(s['page'] == 0 for s in ink), [s['page'] for s in ink])

    # ---------- 4. FSRS ----------
    pg.evaluate("""() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => {
        const tx = q.result.transaction('kv','readwrite').objectStore('kv');
        const cards = [1,2,3].map(i => ({ id:'c'+i, topicId:null, front:'Pregunta '+i, back:'Respuesta '+i, createdAt:Date.now(), due:'2020-01-01', interval:0, ease:2.5, reps:0, lapses:0 }));
        tx.put(JSON.stringify({cards}), 'cards'); r(1); }; })""")
    pg.reload(); pg.wait_for_selector('.rail'); time.sleep(1.2)
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("Repaso de guardia")')
    pg.wait_for_selector('.review')
    ok('la cola de guardia abre en modo una mano', pg.get_attribute('.review', 'data-onehand') == '1')
    ok('trae temporizador de 10 min', '10:00' in pg.inner_text('.review-meta') or '09:5' in pg.inner_text('.review-meta'), pg.inner_text('.review-meta')[:60])
    pg.click('.flashcard'); time.sleep(0.4)
    labels = pg.locator('.grade-row .btn.grade').all_inner_texts()
    ok('los cuatro botones muestran su próximo repaso', len(labels) == 4 and all(any(ch.isdigit() for ch in l) for l in labels), labels)
    pg.locator('.grade-row .btn.grade').nth(2).click(); time.sleep(1.2)
    cards = pg.evaluate(KV, 'cards')['cards']
    graded = [c for c in cards if c.get('s') is not None]
    ok('FSRS guarda estabilidad y dificultad', len(graded) == 1 and graded[0]['s'] > 0 and 1 <= graded[0]['d'] <= 10, graded[0] if graded else cards[0])
    ok('el intervalo sale de la estabilidad', graded and graded[0]['interval'] >= 1, graded[0]['interval'] if graded else None)
    pg.keyboard.press('Escape'); time.sleep(0.4)

    # ---------- 5. Temario editable ----------
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button[title^="GPC y temario"]')
    pg.wait_for_selector('.temario')
    pg.click('.temario .seg button:has-text("Editar")'); pg.wait_for_selector('.temario-edit')
    before = pg.locator('.temario-list.edit li').count()
    pg.fill('.temario-add input[aria-label="Tema nuevo"]', 'Síndrome de Guillain-Barré (mío)')
    pg.click('.temario-add .btn.primary'); time.sleep(0.8)
    ok('el tema nuevo entra al temario', pg.locator('.temario-list.edit li').count() == before + 1, (before, pg.locator('.temario-list.edit li').count()))
    cur = pg.evaluate(KV, 'curriculum')
    ok('se guarda como cambio tuyo, no en el temario base', cur and len(cur['added']) == 1 and cur['added'][0]['id'].startswith('u-'), cur)
    # partir un tema
    pg.locator('.temario-list.edit li').first.locator('.icon-btn[title^="Partir"]').click(); time.sleep(0.8)
    cur = pg.evaluate(KV, 'curriculum')
    ok('partir deja la parte 1 editada y la 2 como tema tuyo', len(cur['added']) == 2 and '(1/2)' in list(cur['patch'].values())[0]['title'], list(cur['patch'].values())[0] if cur['patch'] else cur)
    # quitar
    pg.locator('.temario-list.edit li').nth(2).locator('.icon-btn.danger').click(); time.sleep(0.8)
    cur = pg.evaluate(KV, 'curriculum')
    ok('quitar un tema lo manda a «quitados»', len(cur['hidden']) == 1 and pg.locator('.temario-hidden').count() == 1, cur['hidden'])
    pg.click('.temario-hidden summary'); pg.click('.temario-hidden .btn.ghost'); time.sleep(0.6)
    ok('restaurar lo devuelve', len(pg.evaluate(KV, 'curriculum')['hidden']) == 0)
    pg.keyboard.press('Escape'); time.sleep(0.4)

    # ---------- 6. Historial de simulacros ----------
    pg.evaluate("""() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => {
        const tx = q.result.transaction('kv','readwrite').objectStore('kv');
        const questions = [0,1,2,3].map(i => ({ id:'q'+i, topicId:'mi-01', vignette:'Caso '+i, question:'¿Qué sigue?', options:[{text:'A',why:'a'},{text:'B',why:'b'}], correct:0, cite:null, origin:'manual', reviewed:true, createdAt:Date.now() }));
        const attempts = [
          { id:'a1', date:'2026-11-01', title:'Simulacro · MI', questionIds:['q0','q1','q2','q3'], answers:[0,1,1,1], seconds:600 },
          { id:'a2', date:'2026-11-10', title:'Simulacro · MI', questionIds:['q0','q1','q2','q3'], answers:[0,0,0,1], seconds:540 }];
        tx.put(JSON.stringify({questions, attempts}), 'exam'); r(1); }; })""")
    pg.reload(); pg.wait_for_selector('.rail'); time.sleep(1.0)
    pg.click('.rail-btn:has-text("Simulacros")'); pg.wait_for_selector('.exam-tabs')
    pg.click('.exam-tabs button:has-text("Historial")'); time.sleep(0.8)
    txt = pg.inner_text('.page')
    ok('el historial resume los intentos', '2 simulacros' in txt, txt[:120].replace('\n', ' | '))
    ok('dibuja la tendencia', pg.locator('.trend polyline').count() == 1 and pg.locator('.trend-dot').count() == 2)
    ok('mejora frente a los primeros', '+' in txt and 'pts' in txt, [l for l in txt.split('\n') if 'pts' in l][:1])
    ok('desglosa por especialidad', pg.locator('.spec-bars li').count() >= 1 and 'Medicina Interna' in pg.inner_text('.spec-bars'))
    pg.locator('.attempt-main').first.click(); time.sleep(0.4)
    ok('el detalle trae tiempo por pregunta', 's por pregunta' in pg.inner_text('.attempt-detail'), pg.inner_text('.attempt-detail')[:90])
    ok('ofrece repetir las falladas', pg.locator('.attempt-detail button:has-text("Repetir")').count() == 1)
    pg.click('.attempt-detail button:has-text("Repetir")'); pg.wait_for_selector('.runner, .exam-run', timeout=8000)
    ok('el repaso de falladas arranca', pg.locator('.runner, .exam-run').count() >= 1)
    pg.keyboard.press('Escape'); time.sleep(0.5)

    # ---------- 7. Espacio y revisión ----------
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Respaldo")')
    pg.wait_for_selector('.modal:has-text("Respaldo")')
    pg.click('button:has-text("Espacio y revisión")'); pg.wait_for_selector('.modal:has-text("Espacio y respaldo")')
    pg.wait_for_selector('.size-list li', timeout=8000)
    ok('mide el espacio usado', pg.locator('.quota-bar').count() == 1 and 'MB' in pg.inner_text('.modal:has-text("Espacio y respaldo")'))
    ok('lista los PDF por tamaño', pg.locator('.size-list li').count() >= 1, pg.inner_text('.size-list')[:80].replace('\n', ' | '))
    pg.click('button:has-text("Probar ahora")'); time.sleep(1.2)
    ok('avisa si no hay carpeta conectada', 'carpeta' in pg.inner_text('.modal:has-text("Espacio y respaldo")').lower())
    pg.keyboard.press('Escape'); time.sleep(0.3)

    # ---------- 8. Preferencias: exigencia del repaso ----------
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Preferencias")')
    pg.wait_for_selector('.modal:has-text("Preferencias")')
    pg.click('.modal .seg button:has-text("Estricto")'); time.sleep(0.5)
    ok('la exigencia del repaso se guarda', pg.evaluate("JSON.parse(localStorage.getItem('alq:settings')).retention") == 0.95)
    pg.keyboard.press('Escape')

    errs2 = [e for e in errs if 'favicon' not in e and 'Failed to load resource' not in e]
    ok('sin errores de consola', not errs2, errs2[:3])
    b.close()
srv.shutdown()
print(f'SUMMARY {sum(1 for v in res.values() if v)} / {len(res)}')
