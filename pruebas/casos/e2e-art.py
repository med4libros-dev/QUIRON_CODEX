import threading, http.server, socketserver, functools, time, sys
from playwright.sync_api import sync_playwright

import math as _math


def menu_nota(pg, etiqueta):
    """Exportar vive en el menú ⋯ desde la 0.26."""
    pg.click('button[aria-label="Más acciones de la nota"]')
    pg.click(f'.more-menu button:has-text("{etiqueta}")')


def dial_open(page, which='.pen-dial'):
    """Abre el disco de instrumentos si está cerrado."""
    page.wait_for_selector(which)
    if page.locator(which + '.closed').count():
        page.click(which + ' .dial-knob')
    page.wait_for_selector(which + ' .dial-svg', state='visible')

def dial_close(page, which='.pen-dial'):
    """Cierra el disco por su centro (Escape también devuelve el PDF a «seleccionar»)."""
    if page.locator(which + '.open').count():
        page.click(which + ' .dial-center')

def dial_pick(page, ring, index, total, which='.pen-dial'):
    """Gira un anillo del disco hasta el sector `index` de `total` (tocándolo en su centro)."""
    dial_open(page, which)
    bx = page.locator(which + ' .dial-svg').bounding_box()
    k = bx['width'] / 216
    cx, cy = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
    r = {'tool': 44, 'color': 69, 'size': 94}[ring]
    a = -_math.pi / 2 + (index / total) * _math.pi * 2
    page.mouse.click(cx + r * k * _math.cos(a), cy + r * k * _math.sin(a))

http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
srv = Q(('127.0.0.1', 4178), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/art')); threading.Thread(target=srv.serve_forever, daemon=True).start()
errors, results = [], {}
def ok(name, cond, extra=''):
    results[name] = bool(cond); print(('PASS ' if cond else 'FAIL ') + name, str(extra)[:150]); sys.stdout.flush()
IDB_LIB = """() => new Promise(res => { const r = indexedDB.open('alquimia'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('library'); g.onsuccess = () => res(JSON.parse(g.result || '{}')); }; })"""
IDB_NOTES = IDB_LIB.replace("'library'", "'notes'")
def pen_stroke(page, sel, x0, y0, n=30, dx=7, pid=11):
    page.evaluate(f"""() => {{ const el = document.querySelector('{sel}'); const r = el.getBoundingClientRect();
      const mk = (t, i, pr) => new PointerEvent(t, {{ pointerId: {pid}, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        clientX: r.left + {x0} + i*{dx}, clientY: r.top + {y0} + Math.sin(i/3)*12, pressure: pr, buttons: t==='pointerup'?0:1 }});
      el.dispatchEvent(mk('pointerdown', 0, 0.3)); for (let i = 1; i < {n}; i++) el.dispatchEvent(mk('pointermove', i, 0.3 + (i/{n})*0.6));
      el.dispatchEvent(mk('pointerup', {n}, 0)); }}""")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, color_scheme='light')
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    # El inicio por defecto es el asistente del internado: se arranca en Estudio.
    page.add_init_script("if(!localStorage.getItem('alq:settings')) localStorage.setItem('alq:settings', JSON.stringify({view:'study'}))")
    page.goto('http://127.0.0.1:4178/'); page.wait_for_selector('.empty-state')
    page.screenshot(path='/tmp/tc/shots/n01-empty.png')
    page.set_input_files('.pdf-body input[type=file]', '/tmp/tc/test.pdf')
    page.wait_for_function("() => [...document.querySelectorAll('.pdf-page > canvas')].some(c => c.width > 0)", timeout=15000); time.sleep(0.5)
    ok('pdf loaded', page.locator('.pdf-page').count() == 40)

    first = '.pdf-page[data-page="1"] .ann-layer'
    box = page.locator('.pdf-page').first.bounding_box()
    # Resaltado de área (rosa)
    page.click('button[aria-label="Resaltar área"]')
    page.click('.subbar .swatch[aria-label="Perla clínica / ENARM"]')
    x0, y0 = box['x'] + box['width']*0.08, box['y'] + box['height']*0.11
    page.mouse.move(x0, y0); page.mouse.down(); page.mouse.move(box['x']+box['width']*0.9, box['y']+box['height']*0.17, steps=6); page.mouse.up(); time.sleep(0.7)
    # Subrayado
    page.click('button[aria-label="Subrayar"]')
    page.fill('.subbar input[type=range]', '5') if False else page.evaluate("() => { const r = document.querySelector('.subbar input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(r,'6'); r.dispatchEvent(new Event('input',{bubbles:true})); }")
    uy = box['y'] + box['height']*0.335
    page.mouse.move(box['x']+box['width']*0.1, uy); page.mouse.down(); page.mouse.move(box['x']+box['width']*0.7, uy, steps=6); page.mouse.up(); time.sleep(0.7)
    lib = page.evaluate(IDB_LIB) if False else None
    ok('underline drawn', page.locator('.pdf-page[data-page="1"] .hl.underline').count() == 1)
    # Dibujo libre con rotulador rojo grueso
    page.click('button[aria-label="Escribir / dibujar"]')
    # Instrumentos del PDF: ahora en el disco de la esquina superior derecha.
    dial_pick(page, 'tool', 2, 4, '.pdf-body .pen-dial')   # rotulador
    dial_pick(page, 'color', 1, 8, '.pdf-body .pen-dial')  # rojo #dc2626
    page.locator('.pdf-body .pen-dial .dial-grab[aria-label^="Grosor"]').focus()
    for _ in range(40): page.keyboard.press('ArrowLeft')
    for _ in range(9): page.keyboard.press('ArrowRight')   # rotulador: min 3 → 12
    dial_close(page, '.pdf-body .pen-dial')
    pen_stroke(page, first, 120, 520)
    # marcatextos libre
    dial_pick(page, 'tool', 3, 4, '.pdf-body .pen-dial')
    dial_close(page, '.pdf-body .pen-dial')
    pen_stroke(page, first, 100, 600, pid=12)
    time.sleep(0.8)
    # Post-it
    page.click('button[aria-label="Post-it"]')
    page.click('.subbar .swatch >> nth=2')
    page.mouse.click(box['x']+box['width']*0.6, box['y']+box['height']*0.5); time.sleep(0.3)
    page.keyboard.type('Recordar: BNP < 100 descarta IC')
    time.sleep(0.6)
    ok('sticky created', page.locator('.sticky').count() == 1 and 'BNP' in page.input_value('.sticky-text'))
    page.screenshot(path='/tmp/tc/shots/n02-pdf-tools.png')
    page.click('.sticky-btn[title="Minimizar"]'); time.sleep(0.2)
    ok('sticky minimized', page.locator('.sticky-pin').count() == 1)
    # Deshacer anotación: elimina el post-it (último)
    page.click('button[title="Deshacer anotación (Ctrl+Z)"]'); time.sleep(0.4)
    ok('undo last annotation (sticky)', page.locator('.sticky-pin').count() == 0)
    page.click('button[aria-label="Post-it"]')
    page.mouse.click(box['x']+box['width']*0.75, box['y']+box['height']*0.45); time.sleep(0.2); page.keyboard.type('Perla: furosemida en edema'); time.sleep(0.5)
    page.click('button[aria-label="Navegar"]')
    time.sleep(1.0)
    lib = page.evaluate(IDB_LIB)
    did = list(lib['docs'])[0]['id']
    inks = lib['inks'].get(did, [])
    ok('pdf ink saved (marker+highlighter)', len(inks) == 2 and {s['tool'] for s in inks} == {'marker','highlighter'} and any(s['color']=='#dc2626' and s['size']==12 for s in inks), [(s['tool'], s['color'], s['size']) for s in inks])
    hls = lib['highlights'].get(did, [])
    ok('highlight + underline saved', len(hls) == 2 and any(h.get('style')=='underline' and h.get('thickness')==6 for h in hls), [(h['color'], h.get('style'), h['text'][:30]) for h in hls])

    # Marcadores
    page.fill('.page-input', '12'); page.keyboard.press('Enter'); time.sleep(1.3)
    page.click('button[title^="Marcar la p."]'); time.sleep(0.3)
    page.fill('.page-input', '30'); page.keyboard.press('Enter'); time.sleep(1.3)
    page.keyboard.press('b'); time.sleep(0.3)
    page.click('button[data-bm-toggle]')
    page.wait_for_selector('.bm-list li')
    ok('bookmarks listed', page.locator('.bm-list li').count() == 2, page.inner_text('.bm-list'))
    page.fill('.bm-list li >> nth=0 >> .bm-label', 'Clasificación NYHA'); page.keyboard.press('Enter'); time.sleep(0.2)
    ok('ribbon on bookmarked page', page.locator('.pdf-page[data-page="30"] .page-ribbon').count() == 1)
    page.screenshot(path='/tmp/tc/shots/n03-bookmarks.png')
    # Insertar marcador en la nota (crea la nota si no existe)
    page.click('.bm-list li >> nth=0 >> button[title^="Insertar en la nota"]'); time.sleep(0.8)
    ok('bookmark inserted into note', page.locator('.editor a.pdf-ref').count() == 1, page.inner_text('.editor')[:80])
    page.keyboard.press('Escape')
    page.click('.topbar-title'); time.sleep(0.2)
    # Clic en el enlace → salta a página 12
    page.fill('.page-input', '35'); page.keyboard.press('Enter'); time.sleep(1.2)
    page.click('.editor a.pdf-ref'); time.sleep(1.4)
    ok('pdf-ref jumps to page', page.input_value('.page-input') in ('11','12','13'), page.input_value('.page-input'))

    # Editor tipo Word
    page.click('.editor'); page.keyboard.press('Control+End')
    page.keyboard.press('Enter')
    page.select_option('.fmt-select.style', 'h2'); page.keyboard.type('Insuficiencia cardiaca'); page.keyboard.press('Enter')
    page.keyboard.type('Texto en negrita '); page.keyboard.press('Shift+Home')
    page.click('.fmt-btn[title="Negrita (Ctrl+B)"]'); time.sleep(0.5)
    ok('bold active state', 'on' in (page.get_attribute('.fmt-btn[title="Negrita (Ctrl+B)"]', 'class') or ''))
    page.keyboard.press('End')
    page.click('.fmt-btn[title="Centrar"]')
    page.keyboard.press('Enter'); page.click('.fmt-btn[title="Alinear a la izquierda"]')
    page.click('.fmt-btn[title="Lista de verificación"]'); page.keyboard.type('Repasar NYHA'); page.keyboard.press('Enter'); page.keyboard.type('Hacer flashcards')
    page.keyboard.press('Enter'); page.keyboard.press('Enter')
    page.click('.fmt-btn[title="Insertar tabla"]'); page.hover('.table-grid button >> nth=10'); page.dispatch_event('.table-grid button >> nth=10', 'mousedown')
    time.sleep(0.3)
    page.keyboard.type('Clase')
    ok('table inserted', page.locator('.editor table tr').count() == 2 and page.locator('.editor table tr >> nth=0 >> th').count() == 3)
    # marcar checklist
    li = page.locator('.editor ul.checklist li').first; lb = li.bounding_box()
    page.mouse.click(lb['x'] + 8, lb['y'] + lb['height']/2)
    ok('checklist toggle', page.locator('.editor ul.checklist li.done').count() == 1)
    page.click('.fmt-btn[title="Insertar los resaltados del PDF"]'); time.sleep(0.3)
    ok('highlights inserted', page.locator('.editor h3:has-text("Resaltados")').count() == 1)
    time.sleep(1.0)
    ok('editor saved', 'Guardado' in page.inner_text('.editor-status'))
    page.screenshot(path='/tmp/tc/shots/n04-word.png')
    eh = page.inner_html('.editor')
    ok('rich html kept', '<h2' in eh and ('<b>' in eh or 'bold' in eh or '<strong' in eh) and 'text-align: center' in eh, eh[:200])

    # Exportar Word y PDF
    menu_nota(page, 'Exportar a Word'); time.sleep(0.3)
    ok('download toast', 'no está disponible' in page.inner_text('body'))
    # Lienzo con instrumentos
    page.click('[role=tab]:has-text("Lienzo")'); page.wait_for_selector('.ink-page canvas')
    dial_pick(page, 'tool', 1, 4)
    dial_close(page)
    pen_stroke(page, '.ink-page', 80, 120, pid=21)
    dial_pick(page, 'tool', 2, 4); dial_pick(page, 'color', 2, 8)
    dial_close(page)
    pen_stroke(page, '.ink-page', 80, 220, pid=22)
    dial_pick(page, 'tool', 0, 4)
    # El grosor es continuo: se fija con las flechas sobre el anillo, que es un deslizador.
    page.locator('.pen-dial .dial-grab[aria-label^="Grosor"]').focus()
    for _ in range(40): page.keyboard.press('ArrowLeft')
    for _ in range(8): page.keyboard.press('ArrowRight')
    dial_close(page)
    pen_stroke(page, '.ink-page', 80, 320, pid=23)
    time.sleep(1.0)
    strokes = page.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia'); r.onsuccess = () => { const g = r.result.transaction('ink').objectStore('ink').getAll(); g.onsuccess = () => res(g.result.flat().map(s => [s.tool, s.color, s.size])); }; })""")
    ok('canvas instruments', [s[0] for s in strokes] == ['pencil','marker','pen'] and strokes[2][2] == 9 and strokes[1][1] == '#16a34a', strokes)
    page.screenshot(path='/tmp/tc/shots/n05-canvas.png')

    # Cuadernos
    page.click('[role=tab]:has-text("Texto")')
    page.select_option('.notes-context select >> nth=0', '__new'); page.wait_for_selector('.modal')
    page.select_option('.modal select', label='Cardiología'); page.click('.modal .btn.primary'); time.sleep(0.4)
    ok('notebook created from panel', 'Cardiología' in page.inner_text('.notes-context'))
    ok('note moved into notebook', page.locator('.notes-context select >> nth=0').input_value() != '' and page.locator('.editor a.pdf-ref').count() == 1)
    page.click('.rail-btn:has-text("Cuadernos")'); page.wait_for_selector('.nb-grid')
    page.click('button:has-text("Uno por materia")'); time.sleep(0.3)
    ok('one per subject', page.locator('.nb-card').count() == 10, page.locator('.nb-card').count())
    page.click('.nb-card:has-text("Cardiología")')
    ok('notebook lists note', page.locator('.nb-note').count() == 1)
    page.click('button:has-text("Nuevo cuaderno")'); page.fill('.modal input.input', 'Casos clínicos ENARM'); page.click('.modal .btn.primary'); time.sleep(0.3)
    page.click('.nb-card:has-text("Casos clínicos")'); page.click('.nb-notes .btn.primary:has-text("Nota")'); time.sleep(0.6)
    ok('new note in topic notebook opens study', page.locator('.editor').count() == 1 and 'Casos clínicos' in page.inner_text('.notes-context'))
    page.click('.rail-btn:has-text("Cuadernos")'); time.sleep(0.3)
    page.screenshot(path='/tmp/tc/shots/n06-notebooks.png')

    # Síntesis con post-it
    page.click('.rail-btn:has-text("Estudio")'); page.select_option('.notes-context select >> nth=0', '')
    page.click('[role=tab]:has-text("Síntesis")'); page.click('button:has-text("Generar hoja de repaso")')
    page.wait_for_selector('.synth-result .prose h2', timeout=10000)
    ok('synthesis includes post-it', 'furosemida' in page.inner_text('.synth-result .prose').lower() or 'post-its' in page.inner_text('.synth'))

    # Oscuro
    (page.click('.rail-btn:has-text("Ajustes")') if not page.locator('.rail-pop').count() else None); page.click('.rail-pop button[title^="Tema"]'); (page.click('.rail-btn:has-text("Ajustes")') if not page.locator('.rail-pop').count() else None); page.click('.rail-pop button[title^="Tema"]')
    page.click('[role=tab]:has-text("Texto")'); time.sleep(0.6)
    page.screenshot(path='/tmp/tc/shots/n07-dark.png')
    (page.click('.rail-btn:has-text("Ajustes")') if not page.locator('.rail-pop').count() else None); page.click('.rail-pop button[title^="Tema"]'); (page.click('.rail-btn:has-text("Ajustes")') if not page.locator('.rail-pop').count() else None); page.click('.rail-pop button[title^="Tema"]')
    # Persistencia
    time.sleep(1.0); page.reload(); page.wait_for_selector('.pdf-page > canvas'); time.sleep(1.6)
    ok('persist: sticky + ribbon + underline', page.locator('.sticky, .sticky-pin').count() == 1 and page.locator('.page-ribbon').count() >= 1 and page.locator('.hl.underline').count() == 1)
    lib = page.evaluate(IDB_LIB); nts = page.evaluate(IDB_NOTES)
    ok('persist: notebooks', len(nts['notebooks']) == 11, len(nts['notebooks']))
    page.screenshot(path='/tmp/tc/shots/n08-reload.png')
    b.close()
print('\nCONSOLE ERRORS:', len(errors))
for e in errors[:15]: print('  ', e[:300])
print('SUMMARY', sum(results.values()), '/', len(results))
