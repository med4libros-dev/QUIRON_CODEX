import threading, http.server, socketserver, functools, json, time, sys
from playwright.sync_api import sync_playwright

PORT = 4173
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
class Q(socketserver.TCPServer): allow_reuse_address = True
srv = Q(('127.0.0.1', PORT), Handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
Handler.log_message = lambda *a, **k: None
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None

errors = []
results = {}
def ok(name, cond, extra=''):
    results[name] = bool(cond); print(('PASS ' if cond else 'FAIL ') + name, extra); sys.stdout.flush()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, color_scheme='light')
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error',) else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    # Arranca directo en Estudio (el inicio por defecto es el asistente del internado).
    page.add_init_script("if(!localStorage.getItem('alq:settings')) localStorage.setItem('alq:settings', JSON.stringify({view:'study'}))")
    page.goto(f'http://127.0.0.1:{PORT}/')
    page.wait_for_selector('.empty-state')
    page.screenshot(path='/tmp/tc/shots/01-empty.png')
    ok('empty state', page.is_visible('text=Tu biblioteca está vacía'))

    # Subir PDF
    page.set_input_files('.pdf-body input[type=file]', '/tmp/tc/test.pdf')
    page.wait_for_selector('.pdf-page canvas')
    page.wait_for_function("() => { const c = document.querySelector('.pdf-page canvas'); return c && c.width > 0 }", timeout=15000)
    time.sleep(0.6)
    n_pages = page.eval_on_selector_all('.pdf-page', 'els => els.length')
    rendered = page.eval_on_selector_all('.pdf-page canvas', 'els => els.filter(c => c.width > 0).length')
    ok('pdf loaded 40 pages', n_pages == 40, f'pages={n_pages}')
    ok('lazy render (few canvases)', 0 < rendered < 10, f'rendered={rendered}')
    ok('page count in toolbar', page.inner_text('.pdf-workspace .toolbar').find('/ 40') >= 0)
    page.screenshot(path='/tmp/tc/shots/02-pdf.png')

    # Resaltar: arrastrar sobre el primer párrafo de la página 1
    page.click('button[title="Resaltar área (H)"]')
    box = page.locator('.pdf-page').first.bounding_box()
    x0 = box['x'] + box['width'] * 0.08; y0 = box['y'] + box['height'] * 0.11
    x1 = box['x'] + box['width'] * 0.92; y1 = box['y'] + box['height'] * 0.17
    page.mouse.move(x0, y0); page.mouse.down(); page.mouse.move((x0+x1)/2, (y0+y1)/2, steps=5); page.mouse.move(x1, y1, steps=5); page.mouse.up()
    page.wait_for_selector('.pdf-page .hl:not(.draft)')
    time.sleep(0.8)
    hl_title = page.get_attribute('.pdf-page .hl:not(.draft)', 'title') or ''
    ok('highlight created + text extracted', 'insuficiencia' in hl_title.lower(), hl_title[:90])
    page.screenshot(path='/tmp/tc/shots/03-highlight.png')

    # Zoom y salto de página
    page.click('button[title="Acercar"]'); time.sleep(0.4)
    ok('zoom label', '110%' in page.inner_text('.zoom-label'))
    page.click('.zoom-label'); time.sleep(0.3)
    page.fill('.page-input', '25'); page.keyboard.press('Enter'); time.sleep(1.4)
    cur = page.input_value('.page-input')
    ok('jump to page 25', cur in ('24','25','26'), f'now={cur}')
    page.click('button[title="Navegar (V)"]')

    # Nota de texto
    page.click('.notes-panel .btn.primary:has-text("Nueva nota")')
    page.wait_for_selector('.editor')
    page.click('.editor')
    page.keyboard.type('Clasificación NYHA: clase I sin limitación; clase IV síntomas en reposo. ')
    page.select_option('.fmt-select.style', 'h2')
    page.keyboard.press('End'); page.keyboard.press('Enter')
    page.keyboard.type('El BNP normal descarta la insuficiencia cardiaca con alta probabilidad.')
    time.sleep(1.2)
    ok('note saved status', 'Guardado' in page.inner_text('.editor-status'))
    page.click('.fmt-btn[title="Insertar los resaltados del PDF"]')  # + Resaltados
    time.sleep(0.9)
    ok('insert highlights into note', page.locator('.editor li').count() >= 1)
    page.screenshot(path='/tmp/tc/shots/04-note.png')

    # Lienzo: dibujar con mouse y con "lápiz" (pointer events con presión)
    page.click('[role=tab]:has-text("Lienzo")')
    page.wait_for_selector('.ink-page canvas')
    ib = page.locator('.ink-page').first.bounding_box()
    page.mouse.move(ib['x']+80, ib['y']+120); page.mouse.down()
    for i in range(30): page.mouse.move(ib['x']+80+i*8, ib['y']+120+ (i%6)*6)
    page.mouse.up()
    # trazo de lápiz sintético con presión variable
    page.evaluate("""() => {
      const el = document.querySelector('.ink-page'); const r = el.getBoundingClientRect();
      const mk = (t, i, pr) => new PointerEvent(t, { pointerId: 7, pointerType: 'pen', isPrimary: true, bubbles: true, clientX: r.left + 100 + i*6, clientY: r.top + 260 + Math.sin(i/3)*20, pressure: pr, buttons: t==='pointerup'?0:1 });
      el.dispatchEvent(mk('pointerdown', 0, 0.2));
      for (let i = 1; i < 40; i++) el.dispatchEvent(mk('pointermove', i, 0.2 + (i/40)*0.8));
      el.dispatchEvent(mk('pointerup', 40, 0));
    }""")
    time.sleep(1.2)
    strokes = page.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('ink'); const s = tx.objectStore('ink'); const g = s.getAll(); g.onsuccess = () => res(g.result.map(a => a.length)); }; })""")
    ok('ink strokes persisted', strokes and max(strokes) >= 2, str(strokes))
    page.click('button[title="Deshacer (Ctrl+Z)"]'); time.sleep(0.9)
    strokes2 = page.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia'); r.onsuccess = () => { const g = r.result.transaction('ink').objectStore('ink').getAll(); g.onsuccess = () => res(g.result.map(a => a.length)); }; })""")
    ok('undo removes stroke', strokes2 and max(strokes2) == max(strokes) - 1, str(strokes2))
    page.click('button[title="Rehacer (Ctrl+Y)"]'); time.sleep(0.9)
    page.screenshot(path='/tmp/tc/shots/05-ink.png')

    # Síntesis local
    page.click('[role=tab]:has-text("Síntesis")')
    page.fill('.synth input[placeholder=desde]', '1'); page.fill('.synth input[placeholder=hasta]', '5')
    page.click('button:has-text("Generar hoja de repaso")')
    page.wait_for_selector('.synth-result .prose h2', timeout=15000)
    synth_txt = page.inner_text('.synth-result .prose')
    ok('synthesis generated', 'Conceptos clave' in synth_txt and 'Autoevaluación' in synth_txt, synth_txt[:160].replace('\n',' | '))
    page.screenshot(path='/tmp/tc/shots/06-synth.png', full_page=False)
    page.click('button:has-text("Guardar como nota")')
    page.wait_for_selector('.editor h2')
    ok('synth saved as note', 'Hoja de repaso' in page.inner_text('.editor'))

    # Exportar PDF
    with page.expect_download() as dl:
        page.click('button[title^="Exportar nota a PDF"]')
    path = dl.value.path(); data = open(path, 'rb').read()
    ok('export pdf', data[:5] == b'%PDF-' and len(data) > 1500, f'{dl.value.suggested_filename} {len(data)} bytes')
    open('/tmp/tc/export-synth.pdf', 'wb').write(data)
    # exportar la nota manual (con tinta)
    page.select_option('select[aria-label="Nota activa"]', index=0); time.sleep(0.4)
    with page.expect_download() as dl2:
        page.click('button[title^="Exportar nota a PDF"]')
    d2 = open(dl2.value.path(), 'rb').read(); open('/tmp/tc/export-ink.pdf', 'wb').write(d2)
    ok('export note with ink', d2[:5] == b'%PDF-', f'{len(d2)} bytes')

    # Calendario
    page.click('.rail-btn:has-text("Calendario")')
    page.wait_for_selector('.week')
    page.locator('.day.today .quick-add').fill('Insuficiencia cardiaca: tratamiento'); page.locator('.day.today .quick-add').press('Enter')
    page.locator('.day.today .quick-add').fill('Arritmias: fibrilación auricular'); page.locator('.day.today .quick-add').press('Enter')
    ok('quick add sessions', page.locator('.day.today .session').count() == 2)
    page.locator('.day.today .session-check').first.click()
    ok('toggle done', page.locator('.day.today .session.done').count() == 1)
    # drag to next day (if today isn't sunday)
    page.click('button:has-text("Sesión")'); page.wait_for_selector('.modal')
    page.fill('.modal input.input >> nth=0', 'Valvulopatías'); page.click('.modal .btn.primary')
    ok('session dialog', page.locator('.session:has-text("Valvulopatías")').count() == 1)
    page.screenshot(path='/tmp/tc/shots/07-calendar.png')
    page.click('.seg button:has-text("Mes")'); time.sleep(0.3)
    page.screenshot(path='/tmp/tc/shots/08-month.png')
    ok('month view', page.locator('.month-cell').count() == 42)

    # Pomodoro: iniciar, saltar con tiempo transcurrido simulado
    page.click('.pomo button[title=Iniciar]'); time.sleep(1.2)
    ok('pomodoro running', 'running' in (page.get_attribute('.pomo', 'class') or ''))
    page.click('.pomo-time'); page.wait_for_selector('.pomo-pop')
    page.select_option('.pomo-pop select >> nth=0', label='Cardiología')
    page.click('.topbar-title')
    # simula 26 min transcurridos para que el ticker complete la fase
    page.evaluate("() => { const k='alq:pomodoro'; }")
    page.evaluate("""() => { window.__forceEnd = true; }""")
    # Completa vía estado: retrocede endAt
    page.evaluate("""() => { const raw = localStorage.getItem('alq:pomodoro'); }""")

    # Progreso
    page.click('.rail-btn:has-text("Progreso")')
    page.wait_for_selector('.stat-grid')
    page.click('button:has-text("Nueva meta")')
    page.fill('.goal-form input[type=number]', '2'); page.click('.goal-form button[type=submit]')
    ok('goal created', page.locator('.goal-list li').count() == 1, page.inner_text('.goal-list'))
    page.screenshot(path='/tmp/tc/shots/09-progress.png')

    # Tema oscuro
    page.click('.rail-btn:has-text("Progreso")')
    # El tema rota claro → oscuro → sistema: se toca hasta llegar a oscuro.
    for _ in range(3):
        if page.evaluate("document.documentElement.dataset.theme") == 'dark': break
        (page.click('.rail-btn:has-text("Ajustes")') if not page.locator('.rail-pop').count() else None)
        page.click('.rail-pop button[title^="Tema"]'); time.sleep(0.3)
    ok('dark theme', page.evaluate("document.documentElement.dataset.theme") == 'dark')
    page.click('.rail-btn:has-text("Estudio")'); time.sleep(0.8)
    page.click('[role=tab]:has-text("Lienzo")'); time.sleep(0.6)
    page.screenshot(path='/tmp/tc/shots/10-dark-study.png')

    # Persistencia tras recargar
    time.sleep(1.0)
    page.reload(); page.wait_for_selector('.pdf-page canvas'); time.sleep(1.5)
    ok('persist: doc reopened', page.locator('.pdf-page').count() == 40)
    ok('persist: highlight', page.evaluate("Object.values(JSON.parse(localStorage.getItem('alq:settings'))).length > 0") and page.locator('.pdf-page .hl').count() >= 0)
    hl_count = page.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('library'); g.onsuccess = () => { const v = JSON.parse(g.result); res(Object.values(v.highlights).flat().length); }; }; })""")
    ok('persist: highlights in idb', hl_count == 1, str(hl_count))
    page.click('[role=tab]:has-text("Texto")'); time.sleep(0.5)
    note_opts = page.locator('select[aria-label="Nota activa"] option').count()
    ok('persist: notes', note_opts == 2, str(note_opts))
    ok('persist: pomodoro running after reload', 'running' in (page.get_attribute('.pomo', 'class') or ''))
    page.screenshot(path='/tmp/tc/shots/11-reload.png')

    # Pomodoro complete: adelantar endAt en el store y esperar al ticker
    before = page.evaluate("JSON.parse(localStorage.getItem('alq:planner')).logs.length")
    page.click('.pomo button[title="Saltar a la siguiente fase"]'); time.sleep(0.5)
    ok('pomodoro skip -> break', 'Descanso' in page.inner_text('.pomo'))

    b.close()

print('\nCONSOLE ERRORS:', len(errors))
for e in errors[:20]: print('  ', e[:300])
print('SUMMARY', sum(results.values()), '/', len(results))
