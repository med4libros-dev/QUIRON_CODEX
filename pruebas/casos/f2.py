import threading, http.server, socketserver, functools, time, json, datetime, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
srv = Q(('127.0.0.1', 4190), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:160]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(g.result ? JSON.parse(g.result) : null); }; })"""
INK = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('ink').objectStore('ink').get(k); g.onsuccess = () => r(g.result ?? null); }; })"""
INK_KEYS = """() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('ink').objectStore('ink').getAllKeys(); g.onsuccess = () => r(g.result); }; })"""
start = (datetime.date(2026, 11, 13) - datetime.timedelta(days=40)).isoformat()

def select_text(pg, page_no=1, span_idx=2):
    """Selecciona con el mouse el texto de un renglón de la capa de texto (como lo haría el usuario)."""
    sel = f'.pdf-page[data-page="{page_no}"] .textLayer span'
    pg.wait_for_function(f"() => document.querySelectorAll('{sel}').length > 3", timeout=10000)
    bb = pg.locator(sel).nth(span_idx).bounding_box()
    pg.mouse.move(bb['x'] + 2, bb['y'] + bb['height'] / 2); pg.mouse.down()
    pg.mouse.move(bb['x'] + bb['width'] * 0.8, bb['y'] + bb['height'] / 2, steps=8); pg.mouse.up()
    pg.wait_for_selector('.pearl-menu', timeout=4000)

def pen_rect(pg, sel, fx0, fy0, fx1, fy1, pid=21):
    pg.evaluate(f"""() => {{ const el = document.querySelector('{sel}'); const r = el.getBoundingClientRect();
      const P = (t, fx, fy) => el.dispatchEvent(new PointerEvent(t, {{ pointerId: {pid}, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, pressure: t === 'pointerup' ? 0 : 0.5, buttons: t === 'pointerup' ? 0 : 1 }}));
      P('pointerdown', {fx0}, {fy0}); for (let i = 1; i <= 10; i++) P('pointermove', {fx0} + ({fx1}-{fx0})*i/10, {fy0} + ({fy1}-{fy0})*i/10); P('pointerup', {fx1}, {fy1}); }}""")

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 13, 9, 0))
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://127.0.0.1:4190/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0', start); pg.fill('.setup input[type=number] >> nth=0', '60'); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card')

    # ---------- 1. Biblioteca GPC multi-documento ----------
    pg.click('button:has-text("Temario")'); pg.wait_for_selector('.temario')
    pg.fill('.temario input', 'neumonia adquirida'); time.sleep(0.2)
    ok('temario search (sin acentos)', pg.locator('.temario-list li').count() == 1, pg.inner_text('.temario-list'))
    pg.click('.temario-list li >> nth=0 >> button'); pg.wait_for_selector('.topic-sheet')
    ok('topic sheet opens on Documentos', 'Neumonía adquirida' in pg.inner_text('.modal-head') and 'Buscar GPC' in pg.inner_text('.topic-sheet'))
    href = pg.get_attribute('.gpc-box a', 'href') or ''
    ok('GPC search limited to official domains', all(d in href for d in ['imss.gob.mx', 'gob.mx', 'issste.gob.mx']) and 'cenetec-difusion' not in href, href[:100])
    pg.set_input_files('.topic-sheet input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf', '/tmp/tc/043GRR_Neumonia.pdf'])
    pg.wait_for_function("() => document.querySelectorAll('.att').length === 2", timeout=8000)
    badges = pg.locator('.att-badge').all_inner_texts()
    ok('two attachments auto-classified GRR + GER', badges == ['GRR', 'GER'], badges)
    pg.screenshot(path='/tmp/tc/shots/f2-01-docs.png')
    pg.click('.ts-tabs button:has-text("Vista de Guardia")'); time.sleep(0.2)
    ok('guard tab shows CURB-65 for this topic', pg.locator('.calc[data-calc="curb65"]').count() == 1)
    pg.click('.ts-tabs button:has-text("Documentos")')
    pg.click('.topic-sheet .btn:has-text("Estudiar")'); pg.wait_for_selector('.pdf-page'); time.sleep(0.8)
    active = json.loads(pg.evaluate("localStorage.getItem('alq:settings')"))['activeDocId']
    dname = [d['name'] for d in pg.evaluate(KV, 'library')['docs'] if d['id'] == active]
    ok('Estudiar opens the GER (not the GRR) + topic note', dname and 'GER' in dname[0] and 'Neumonía' in pg.input_value('.note-title'), dname)

    # ---------- 2. Extractor de perlas ----------
    pg.wait_for_function("() => document.querySelectorAll('.pdf-page[data-page=\"1\"] .textLayer span').length > 3", timeout=10000)
    ok('text layer rendered (selectable)', True)
    nonempty = pg.evaluate("() => [...document.querySelectorAll('.textLayer')].filter(t => t.childElementCount).length")
    ok('text layer only on nearby pages (memory)', 0 < nonempty <= 8, nonempty)
    select_text(pg, 1, 2)
    sel_text = pg.evaluate("() => document.getSelection().toString()")
    ok('selection → pearl menu with 7 actions', pg.locator('.pearl-btn').count() == 7, sel_text[:60])
    ok('pearl target defaults to linked topic', 'Neumonía' in pg.evaluate("() => { const s = document.querySelector('.pearl-head select'); return s.options[s.selectedIndex].text; }"))
    pg.screenshot(path='/tmp/tc/shots/f2-02-pearl.png')
    pg.click('.pearl-btn:has-text("Apunte")'); time.sleep(0.6)
    ed = pg.locator('.editor')
    ok('Apunte → blockquote in topic note', ed.locator('blockquote.pearl').count() == 1)
    ok('Apunte keeps page reference', ed.locator('a.pdf-ref[data-page="1"]').count() >= 1)
    ok('toast feedback', 'Perla enviada' in pg.inner_text('.toast'))
    ok('selection cleared + menu closed', pg.locator('.pearl-menu').count() == 0)
    time.sleep(1.0)
    notes = pg.evaluate(KV, 'notes')['notes']
    ok('pearl persisted in note html', any('class="pearl"' in n['html'] for n in notes))

    # Flashcard
    select_text(pg, 1, 4)
    back_expect = pg.evaluate("() => document.getSelection().toString().replace(/\\s+/g,' ').trim()")
    pg.click('.pearl-btn:has-text("Flashcard")'); pg.wait_for_selector('.card-form')
    back = pg.input_value('.card-form textarea >> nth=1')
    ok('Flashcard modal: text on the back', back and back[:20] == back_expect[:20], back[:60])
    ok('Flashcard: focus on question', pg.evaluate("() => document.activeElement === document.querySelectorAll('.card-form textarea')[0]"))
    pg.keyboard.type('¿Qué escala estratifica la gravedad de la neumonía?')
    pg.keyboard.press('Control+Enter'); time.sleep(0.8)
    cards = pg.evaluate(KV, 'cards')['cards']
    ok('flashcard saved with topic, source page and due today', len(cards) == 1 and cards[0]['topicId'] and cards[0]['source']['page'] == 1 and cards[0]['due'] == '2026-11-13', cards[0] if cards else None)

    # Guardia
    pg.screenshot(path='/tmp/tc/shots/f2-dbg.png')
    print('spans', pg.locator('.pdf-page[data-page="1"] .textLayer span').count(), pg.locator('.modal').count(), pg.evaluate("() => document.getSelection().toString()")[:40])
    select_text(pg, 1, 6)
    pg.click('.pearl-btn:has-text("Guardia")'); pg.click('.pearl-guard button:has-text("Criterios")'); time.sleep(0.9)
    topics = pg.evaluate(KV, 'topics')
    tid = [k for k, v in topics['info'].items() if v['attachments']][0]
    ok('Guardia → appended to pocket card with source', 'p. 1' in topics['info'][tid]['guard']['criteria'], topics['info'][tid]['guard']['criteria'][:80])

    # ---------- 3. Recorte con lápiz → lienzo ----------
    pg.keyboard.press('r'); time.sleep(0.2)
    ok('crop tool via R', pg.get_attribute('.pdf-scroll', 'data-tool') == 'crop')
    pen_rect(pg, '.pdf-page[data-page="1"] .ann-layer', 0.08, 0.05, 0.9, 0.3)
    pg.wait_for_selector('.pearl-menu', timeout=4000)
    ok('pen crop → pearl menu (Recorte)', 'recorte' in pg.inner_text('.pearl-kind').lower())
    pg.click('.pearl-btn:has-text("Lienzo")'); pg.wait_for_selector('.ink-img', timeout=6000); time.sleep(0.4)
    ok('crop pasted on canvas, ink tab active', pg.locator('.notes-panel [role=tab][aria-selected=true]').inner_text().strip().startswith('Lienzo') or 'Lienzo' in pg.inner_text('.notes-panel [role=tab][aria-selected=true]'))
    note_id = [n for n in pg.evaluate(KV, 'notes')['notes'] if 'Neumonía' in n['title']][0]['id']
    imgs = pg.evaluate(INK, f'{note_id}:img')
    ok('crop image stored in idb (jpeg, logical coords)', imgs and imgs[0]['src'].startswith('data:image/jpeg') and imgs[0]['w'] > 500, (len(imgs or []), (imgs or [{}])[0].get('w')))
    # Rayar encima con el lápiz
    page_sel = '.ink-page >> nth=0'
    bb = pg.locator('.ink-page').first.bounding_box()
    pg.evaluate("""() => { const el = document.querySelector('.ink-page'); const r = el.getBoundingClientRect();
      const P = (t, i) => el.dispatchEvent(new PointerEvent(t, { pointerId: 31, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + 120 + i * 8, clientY: r.top + 90 + Math.sin(i / 2) * 10, pressure: 0.6, buttons: t === 'pointerup' ? 0 : 1 }));
      P('pointerdown', 0); for (let i = 1; i < 30; i++) P('pointermove', i); P('pointerup', 30); }""")
    time.sleep(1.0)
    strokes = pg.evaluate(INK, note_id) or []
    ok('pen draws over the crop', len(strokes) == 1, len(strokes))
    pg.evaluate("() => document.querySelector('.ink-page').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: 300, clientY: 300 }))")
    pg.evaluate("() => document.querySelector('.ink-page').dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: 300, clientY: 300 }))")
    time.sleep(0.8)
    ok('palm/finger does not draw (pen only)', len(pg.evaluate(INK, note_id) or []) == 1)
    pg.screenshot(path='/tmp/tc/shots/f2-03-canvas.png')
    pg.click('.ink-toolbar button[title^="Borrador"]'); time.sleep(0.2)
    ok('eraser shows remove-crop button', pg.locator('.ink-img-del').count() == 1)
    pg.click('.ink-toolbar button[title^="Borrador"]')
    # Exportar PDF con imagen
    with pg.expect_download(timeout=20000) as dl:
        pg.click('.notes-panel button:has-text("PDF")')
    ok('export PDF with crop image', dl.value.suggested_filename.endswith('.pdf'), dl.value.suggested_filename)
    pg.keyboard.press('Escape'); pg.keyboard.press('v')

    # ---------- 4. Vista de Guardia + calculadoras ----------
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("Guardia")'); pg.wait_for_selector('.guard-quick')
    pg.click('.gq-chips button:has-text("Neumonía")'); time.sleep(0.2)
    ok('pocket card shows saved criterion', 'p. 1' in pg.inner_text('.pocket-card.f-criteria'))
    curb = '.guard-quick .calc[data-calc="curb65"]'
    if pg.locator(curb + '.open').count() == 0: pg.click(curb + ' .calc-head')
    for lbl in ['Confusión', 'FR ≥ 30', 'Edad ≥ 65']:
        pg.click(f'{curb} .calc-check:has-text("{lbl}") input')
    r = pg.inner_text(curb + ' .calc-result')
    ok('CURB-65 = 3 → hospitalizar', '3/5' in r and 'hospitalizar' in r, r)
    pg.select_option('.guard-quick select[aria-label="Calculadora"]', 'glasgow'); time.sleep(0.2)
    gl = '.guard-quick .calc[data-calc="glasgow"]'
    for i in range(3): pg.select_option(f'{gl} select >> nth={i}', '0')
    ok('Glasgow 4+5+6 = 15', '15/15' in pg.inner_text(gl + ' .calc-result'))
    for i, v in enumerate(['3', '4', '5']): pg.select_option(f'{gl} select >> nth={i}', v)
    ok('Glasgow 1+1+1 = 3 grave', '3/15' in pg.inner_text(gl + ' .calc-result') and 'Grave' in pg.inner_text(gl + ' .calc-result'))
    pg.screenshot(path='/tmp/tc/shots/f2-04-guard.png')
    pg.keyboard.press('Escape')

    # ---------- 5. Bitácora de casos ----------
    pg.click('.rail-btn:has-text("Inicio")'); pg.wait_for_selector('.day-card')
    pg.click('.card:has(h4:has-text("Casos vistos")) button:has-text("Registrar")'); pg.wait_for_selector('.case-form')
    pg.select_option('.modal select[aria-label="Tema"]', tid)
    pg.fill('.case-form input[aria-label="Paciente"]', 'Sr. Juan Pérez, cama 12')
    time.sleep(0.2)
    ok('privacy warning for name + bed', pg.locator('.privacy-warn').count() == 1 and 'nombre' in pg.inner_text('.privacy-warn'), pg.inner_text('.privacy-warn') if pg.locator('.privacy-warn').count() else '')
    pg.fill('.case-form input[aria-label="Paciente"]', 'M 72 a, EPOC')
    pg.fill('.case-form input[aria-label="Hallazgo principal"]', 'Crepitantes basales der., FR 32')
    pg.fill('.case-form input[aria-label="Manejo"]', 'Hospitalización, cultivos, antibiótico según GPC')
    ok('warning clears when anonymous', pg.locator('.privacy-warn').count() == 0)
    pg.click('.case-form button:has-text("Guardar caso")'); time.sleep(0.3)
    pg.keyboard.press('Escape'); time.sleep(0.8)
    ok('case listed on Inicio', 'M 72 a, EPOC' in pg.inner_text('.case-mini'))
    ok('case persisted under topic', len(pg.evaluate(KV, 'topics')['info'][tid]['cases']) == 1)

    # ---------- 6. Flashcards: repaso ----------
    ok('Inicio shows 1 due card', pg.inner_text('.fc-due b') == '1')
    pg.click('.fc-due button:has-text("Repasar")'); pg.wait_for_selector('.flashcard')
    pg.keyboard.press(' '); time.sleep(0.1)
    ok('flip shows back + source', pg.locator('.fc-back .pdf-ref').count() == 1)
    pg.click('.btn.grade.g2'); time.sleep(0.6)
    ok('session complete', 'Sesión completa' in pg.inner_text('.review'))
    pg.keyboard.press('Escape'); time.sleep(0.8)
    c = pg.evaluate(KV, 'cards')['cards'][0]
    # FSRS: una tarjeta nueva con «Bien» vuelve en unos días (no al día siguiente, como SM-2).
    # El reloj de esta prueba está fijo en el 13 de noviembre de 2026.
    expected = ['2026-11-16', '2026-11-17', '2026-11-18']
    ok('FSRS: Bien en tarjeta nueva → vuelve en ~4 días', c['due'] in expected and c['reps'] == 1 and c['s'] > 1, (c['due'], c['reps'], round(c.get('s', 0), 2)))

    # ---------- 7. Modo supervivencia ----------
    before = json.loads(pg.evaluate("localStorage.getItem('alq:internship')"))
    pending_today = pg.locator('.day-card .lesson:not(.done)').count()
    pg.click('.day-card button:has-text("Hoy no doy más")'); pg.wait_for_selector('.day-card.survival'); time.sleep(0.3)
    st = json.loads(pg.evaluate("localStorage.getItem('alq:internship')"))
    moved = st['survival'].get('2026-11-13', [])
    ok('survival moves every pending lesson of today', len(moved) == pending_today and pending_today > 0, (len(moved), pending_today))
    ok('targets are future days (≤ 3 weeks)', all('2026-11-13' < st['shifts'][i] <= '2026-12-04' for i in moved), [st['shifts'][i] for i in moved])
    ok('done marks untouched', st['done'] == before['done'])
    ok('survival card lists the moved lessons', pg.locator('.moved-list li').count() == len(moved))
    pg.screenshot(path='/tmp/tc/shots/f2-05-survival.png')
    pg.click('.day-card.survival .btn.big'); pg.wait_for_selector('.review')
    ok('express session has a 10-min timer', '10:00' in pg.inner_text('.chip.timer') or '09:5' in pg.inner_text('.chip.timer'), pg.inner_text('.chip.timer'))
    pg.keyboard.press('Escape')
    ok('no pending overdue created by survival', pg.locator('.card:has(h4:has-text("Pendientes")) .lesson:has-text("reprogramada")').count() == 0)
    # El día destino muestra la lección reprogramada
    target = st['shifts'][moved[0]]
    pg.evaluate(f"() => {{ [...document.querySelectorAll('.cal-cell')].find(b => !b.classList.contains('out') && b.textContent.trim().startsWith('{int(target[-2:])}'))?.click(); }}")
    time.sleep(0.3)
    if target[:7] != '2026-11': pg.click('.mini-cal button[aria-label="Mes siguiente"]'); pg.evaluate(f"() => [...document.querySelectorAll('.cal-cell')].find(b => !b.classList.contains('out') && b.textContent.trim().startsWith('{int(target[-2:])}'))?.click()"); time.sleep(0.3)
    ok('moved lesson appears on its new day', 'reprogramada' in pg.inner_text('.day-card'), target)
    pg.click('button:has-text("Volver a hoy")') if pg.locator('button:has-text("Volver a hoy")').count() else None
    pg.wait_for_selector('.day-card.survival')
    pg.click('.day-card.survival button:has-text("Deshacer")'); time.sleep(0.3)
    st2 = json.loads(pg.evaluate("localStorage.getItem('alq:internship')"))
    ok('undo restores the day', not st2['survival'] and not st2['shifts'] and pg.locator('.day-card .lesson').count() >= pending_today)

    # ---------- 8. Persistencia y respaldo ----------
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(0.5)
    ok('cards, topics and cases survive reload', pg.inner_text('.fc-card').count('1') >= 1 and 'M 72 a, EPOC' in pg.inner_text('.case-mini'))
    keys = pg.evaluate(INK_KEYS)
    ok('ink images key present (included in backup)', any(str(k).endswith(':img') for k in keys), keys)
    kvkeys = pg.evaluate("() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').getAllKeys(); g.onsuccess = () => r(g.result); }; })")
    ok('kv has topics + cards (backup copies all kv)', 'topics' in kvkeys and 'cards' in kvkeys, kvkeys)

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5])
    ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
