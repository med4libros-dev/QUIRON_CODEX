# -*- coding: utf-8 -*-
"""Quirón Codex 0.8: letra reconocida, Ctrl+F, pestañas, oclusión, papelera, etiquetas y exportaciones."""
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
srv = Q(('127.0.0.1', 4193), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs, calls = {}, [], []
PG = [None]
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(g.result ? (typeof g.result === 'string' ? JSON.parse(g.result) : g.result) : null); }; })"""
INK = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('ink').objectStore('ink').get(k); g.onsuccess = () => r(g.result ?? null); }; })"""
OCR_TEXT = 'Bronquiolitis: lactante con sibilancias\nTratamiento de soporte'

def claude(route):
    body = json.loads(route.request.post_data or '{}')
    calls.append(body)
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': [{'type': 'text', 'text': OCR_TEXT}]}))

def pen_stroke(pg, sel, fx0, fy0, fx1, fy1, pid=31):
    pg.evaluate(f"""() => {{ const el = document.querySelector('{sel}'); const r = el.getBoundingClientRect();
      const P = (t, fx, fy) => el.dispatchEvent(new PointerEvent(t, {{ pointerId: {pid}, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, pressure: t === 'pointerup' ? 0 : 0.5, buttons: t === 'pointerup' ? 0 : 1 }}));
      P('pointerdown', {fx0}, {fy0}); for (let i = 1; i <= 12; i++) P('pointermove', {fx0} + ({fx1}-{fx0})*i/12, {fy0} + ({fy1}-{fy0})*i/12); P('pointerup', {fx1}, {fy1}); }}""")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 920}, accept_downloads=True)
    pg = ctx.new_page(); PG[0] = pg
    pg.route('https://api.anthropic.com/**', claude)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: d.accept())
    # Arranca en Estudio con clave de IA puesta (el reconocimiento de letra la necesita).
    pg.add_init_script("if(!localStorage.getItem('alq:settings')) localStorage.setItem('alq:settings', JSON.stringify({view:'study', apiKey:'sk-ant-test', model:'claude-sonnet-5-5', aiProvider:'claude'}))")
    pg.goto('http://127.0.0.1:4193/'); pg.wait_for_selector('.empty-state')

    # ---------- 1. Pestañas de guías ----------
    pg.set_input_files('.pdf-body input[type=file]', ['/tmp/tc/test.pdf', '/tmp/tc/043GER_Neumonia.pdf'])
    pg.wait_for_selector('.pdf-page canvas'); time.sleep(1.0)
    ok('una guía abierta, sin pestañas', pg.locator('.doc-tab').count() == 0)
    pg.click('.toolbar .icon-btn[title="Biblioteca de PDFs"]'); pg.wait_for_selector('.library-list')
    pg.click('.library-item:not(.active) .library-name'); time.sleep(1.0)
    ok('dos guías → dos pestañas', pg.locator('.doc-tab').count() == 2, pg.locator('.doc-tab').all_inner_texts())
    ok('la pestaña activa es la que se abrió', pg.locator('.doc-tab.active').count() == 1)
    first = pg.locator('.doc-tab').first.inner_text()
    pg.locator('.doc-tab').first.locator('.doc-tab-name').click(); time.sleep(0.8)
    ok('cambiar de pestaña cambia de guía', first[:8] in pg.locator('.doc-tab.active').inner_text())
    pg.locator('.doc-tab').last.locator('.doc-tab-x').click(); time.sleep(0.5)
    ok('cerrar una pestaña la quita', pg.locator('.doc-tab').count() == 0)

    # ---------- 2. Ctrl+F dentro de la guía ----------
    pg.keyboard.press('Control+f'); pg.wait_for_selector('.find-bar')
    pg.fill('.find-input', 'cardiaca (p. 7)')
    for _ in range(40):
        if 'de 1' in pg.inner_text('.find-count'): break
        pg.wait_for_timeout(250)
    ok('Ctrl+F encuentra la coincidencia única', '1 de 1' in pg.inner_text('.find-count') and 'p. 7' in pg.inner_text('.find-count'), pg.inner_text('.find-count'))
    pg.wait_for_timeout(1200)
    ok('salta a la página de la coincidencia', pg.input_value('.page-input') in ('6', '7', '8'), pg.input_value('.page-input'))
    pg.wait_for_selector('.find-hit', timeout=8000)
    ok('la coincidencia se marca sobre la página', pg.locator('.find-hit').count() >= 1, pg.locator('.find-hit').count())
    pg.fill('.find-input', 'NYHA'); pg.wait_for_timeout(900)
    many = pg.inner_text('.find-count')
    ok('varias coincidencias se numeran', ' de ' in many and int(many.split(' de ')[1].split(' ')[0]) > 5, many)
    pg.click('.find-bar button[title^="Siguiente"]'); pg.wait_for_timeout(500)
    ok('«siguiente» avanza', many != pg.inner_text('.find-count'), pg.inner_text('.find-count'))
    pg.keyboard.press('Escape'); time.sleep(0.3)
    ok('Esc cierra la búsqueda y quita las marcas', pg.locator('.find-bar').count() == 0 and pg.locator('.find-hit').count() == 0)

    # ---------- 3. Recorte de márgenes ----------
    pg.click('.toolbar .icon-btn[title^="Recortar márgenes"]'); time.sleep(0.4)
    ok('márgenes recortados al 4 %', pg.get_attribute('.pdf-scroll', 'data-crop') == '1' and '4%' in (pg.get_attribute('.pdf-scroll', 'style') or ''), pg.get_attribute('.pdf-scroll', 'style'))
    pg.click('.toolbar .icon-btn[title^="Márgenes recortados"]'); time.sleep(0.3)
    pg.click('.toolbar .icon-btn[title^="Márgenes recortados"]'); time.sleep(0.3)
    ok('vuelve a página completa', pg.get_attribute('.pdf-scroll', 'data-crop') is None)
    ok('el recorte se guarda en ajustes', pg.evaluate("JSON.parse(localStorage.getItem('alq:settings')).pdfCrop") == 0)

    # ---------- 4. Índice del archivo ----------
    pg.click('button[data-bm-toggle]'); pg.wait_for_selector('.bm-menu')
    pg.click('.bm-menu [role=tab]:has-text("Índice del archivo")'); time.sleep(1.2)
    txt = pg.inner_text('.bm-menu')
    ok('la pestaña de índice responde', 'índice' in txt.lower(), txt[:90].replace('\n', ' | '))
    pg.keyboard.press('Escape'); pg.click('.pdf-body', position={'x': 10, 'y': 10}); time.sleep(0.3)

    # ---------- 5. Resaltados del tema ----------
    pg.keyboard.press('h'); time.sleep(0.2)
    pen_stroke(pg, '.pdf-page[data-page="1"] .ann-layer', 0.1, 0.12, 0.8, 0.13)
    time.sleep(1.0)
    ok('resaltado creado', pg.locator('.pdf-page .hl').count() >= 1)
    pg.keyboard.press('v')

    # ---------- 6. Oclusión de imágenes ----------
    # Se vuelve al inicio del documento: el menú del recorte se coloca junto a la zona recortada.
    pg.evaluate("() => { document.querySelector('.pdf-scroll').scrollTop = 0; }"); time.sleep(1.0)
    pg.keyboard.press('r'); time.sleep(0.2)
    pen_stroke(pg, '.pdf-page[data-page="1"] .ann-layer', 0.08, 0.05, 0.9, 0.3, pid=32)
    pg.wait_for_selector('.pearl-menu', timeout=6000)
    ok('el recorte ofrece «Tapar»', pg.locator('.pearl-btn:has-text("Tapar")').count() == 1 and pg.locator('.pearl-btn:has-text("Tapar")').is_enabled(),
       (pg.inner_text('.pearl-kind'), pg.locator('.pearl-btn:has-text("Tapar")').is_enabled()))
    pg.click('.pearl-btn:has-text("Tapar")'); pg.wait_for_selector('.occ-edit')
    bb = pg.locator('.occ-edit').bounding_box()
    for x0, x1 in [(0.1, 0.3), (0.5, 0.75)]:
        pg.mouse.move(bb['x'] + bb['width'] * x0, bb['y'] + bb['height'] * 0.2); pg.mouse.down()
        pg.mouse.move(bb['x'] + bb['width'] * x1, bb['y'] + bb['height'] * 0.45, steps=6); pg.mouse.up()
        time.sleep(0.3)
    ok('se dibujaron dos cajas', pg.locator('.occ-box.editing').count() == 2, pg.locator('.occ-box.editing').count())
    pg.click('.occ-foot .btn.primary'); time.sleep(0.8)
    cards = pg.evaluate(KV, 'cards')['cards']
    occ = [c for c in cards if c.get('occlusion')]
    ok('una tarjeta por etiqueta tapada', len(occ) == 2 and {c['occlusion']['target'] for c in occ} == {0, 1}, [c['front'] for c in occ])
    ok('las tarjetas guardan la imagen y las cajas', all(c.get('image', '').startswith('data:image') and len(c['occlusion']['boxes']) == 2 for c in occ))

    # ---------- 7. Reconocer mi letra ----------
    pg.click('.notes-panel .btn.primary:has-text("Nueva nota")'); pg.wait_for_selector('.editor')
    pg.click('.notes-panel [role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas')
    pen_stroke(pg, '.ink-page', 0.15, 0.2, 0.7, 0.25, pid=33)
    time.sleep(1.6)
    pg.click('.notes-panel [data-note-more]'); pg.wait_for_selector('.more-menu')
    pg.click('.more-menu button:has-text("Reconocer mi letra")'); pg.wait_for_selector('.modal:has-text("Reconocer mi letra")')
    pg.click('.modal .btn.primary:has-text("Reconocer")')
    pg.wait_for_selector('.ocr-text', timeout=15000)
    ok('la transcripción llega del motor de IA', 'Bronquiolitis' in pg.input_value('.ocr-text'), pg.input_value('.ocr-text')[:60])
    ok('se envió la hoja como imagen', bool(calls) and isinstance(calls[-1]['messages'][0]['content'], list) and calls[-1]['messages'][0]['content'][0]['type'] == 'image', type(calls[-1]['messages'][0]['content']).__name__ if calls else 'sin llamadas')
    ok('la imagen va en PNG base64', calls[-1]['messages'][0]['content'][0]['source']['media_type'] == 'image/png')
    saved = False
    for _ in range(16):
        notes = (pg.evaluate(KV, 'notes') or {}).get('notes', [])
        saved = any('Bronquiolitis' in (n.get('inkText') or '') for n in notes)
        if saved: break
        pg.wait_for_timeout(300)
    ok('el texto queda guardado en la nota', saved)
    pg.click('.modal .btn.primary:has-text("Pasar al texto")'); time.sleep(1.0)
    ok('la transcripción pasa al editor', 'Bronquiolitis' in pg.inner_text('.editor'))

    # ---------- 8. Ctrl+K encuentra lo escrito a mano ----------
    pg.keyboard.press('Control+k'); pg.wait_for_selector('.search-box')
    pg.fill('.search-box input', 'sibilancias'); time.sleep(0.8)
    hits = pg.inner_text('.search-results')
    ok('Ctrl+K encuentra la letra reconocida', 'Notas' in hits and 'sibilancias' in hits.lower(), hits[:110].replace('\n', ' | '))
    pg.keyboard.press('Escape')

    # ---------- 9. Historial de la nota ----------
    pg.click('.notes-panel [role=tab]:has-text("Texto")'); pg.wait_for_selector('.editor')
    pg.click('.editor'); pg.keyboard.press('Control+End')
    pg.keyboard.type(' Primera versión del apunte.'); time.sleep(1.4)
    pg.keyboard.type(' Segunda línea escrita después.'); time.sleep(1.4)
    pg.click('.notes-panel [data-note-more]'); pg.click('.more-menu button:has-text("Historial")')
    pg.wait_for_selector('.modal:has-text("Historial")')
    # El historial se lee de IndexedDB: hay que esperar a que termine de buscar.
    try:
        pg.wait_for_selector('.hist-list li', timeout=8000)
    except Exception:
        pass
    ok('el historial guarda la versión anterior', pg.locator('.hist-list li').count() >= 1, pg.inner_text('.modal')[:90].replace('\n',' '))
    pg.click('.hist-list .btn.ghost'); time.sleep(1.2)
    ok('restaurar devuelve el texto anterior', 'Segunda línea' not in pg.inner_text('.editor') and 'Primera versión' not in pg.inner_text('.editor') and 'Bronquiolitis' in pg.inner_text('.editor'), pg.inner_text('.editor')[-90:])
    pg.keyboard.press('Escape')

    # ---------- 10. Etiquetas ----------
    pg.click('.notes-panel [data-note-more]'); pg.click('.more-menu button:has-text("Etiquetas")')
    pg.wait_for_selector('.modal:has-text("Etiquetas")')
    pg.fill('.modal input[aria-label="Nueva etiqueta"]', 'Guardia'); pg.keyboard.press('Enter'); time.sleep(0.4)
    ok('la etiqueta se normaliza a minúsculas', pg.locator('.modal .tag').first.inner_text().strip().startswith('guardia'), pg.locator('.modal .tag').first.inner_text())
    pg.keyboard.press('Escape'); time.sleep(0.3)
    notes = pg.evaluate(KV, 'notes')['notes']
    ok('la etiqueta se guarda en la nota', any('guardia' in (n.get('tags') or []) for n in notes))

    # ---------- 11. Tapar y repasar (Cornell) ----------
    pg.click('.notes-panel [role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page')
    abrir_hoja(pg)
    pg.select_option('.hoja-pop select[aria-label="Tipo de hoja"]', 'cornell')
    pg.keyboard.press('Escape'); time.sleep(0.4)
    ok('aparece «Tapar y repasar» en hoja Cornell', pg.locator('.ink-toolbar button:has-text("Tapar y repasar")').count() == 1)
    pg.click('.ink-toolbar button:has-text("Tapar y repasar")'); time.sleep(0.4)
    ok('la columna queda tapada', pg.locator('.ink-mask').count() >= 1)
    masked = pg.locator('.ink-mask').count()
    pg.locator('.ink-mask').first.click(); time.sleep(0.3)
    ok('al tocar se destapa esa hoja', pg.locator('.ink-mask').count() == masked - 1, (masked, pg.locator('.ink-mask').count()))
    pg.click('.ink-toolbar button:has-text("Tapar y repasar")'); time.sleep(0.3)

    # ---------- 12. Papelera: hoja del lienzo ----------
    # Sin hojas continuas para contar hojas reales (la hoja de más no se guarda).
    abrir_hoja(pg)
    pg.click('.hoja-pop button[aria-pressed="true"][title^="Hojas continuas"]'); time.sleep(0.5)
    ok('se pueden apagar las hojas continuas', pg.locator('.hoja-pop button[title^="Hojas continuas: apagadas"]').count() == 1)
    pg.keyboard.press('Escape'); time.sleep(0.3)
    pg.click('.ink-sheet .icon-btn[title="Insertar una hoja antes de esta"]'); time.sleep(0.8)
    sheets = pg.locator('.ink-sheet').count()
    pg.locator('.ink-sheet').last.locator('.icon-btn[title="Quitar hoja"]').click(); time.sleep(1.0)
    ok('quitar una hoja la saca del lienzo', pg.locator('.ink-sheet').count() == sheets - 1, (sheets, pg.locator('.ink-sheet').count()))
    trash = pg.evaluate(KV, 'trash')
    ok('la hoja con trazos fue a la papelera', trash and any(i['payload']['kind'] == 'sheet' for i in trash['items']), [i['payload']['kind'] for i in (trash or {}).get('items', [])])

    # ---------- 13. Papelera: nota ----------
    pg.click('.notes-panel .icon-btn.danger[title^="Eliminar nota"]'); time.sleep(1.0)
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Papelera")')
    pg.wait_for_selector('.modal:has-text("Papelera")')
    ok('la nota borrada aparece en la papelera', pg.locator('.trash-list li:has-text("Nota")').count() >= 1, pg.inner_text('.trash-list')[:120].replace('\n', ' | '))
    ok('la papelera muestra los días restantes', '30 d' in pg.inner_text('.trash-list'))
    pg.locator('.trash-list li:has-text("Nota")').first.locator('.btn.ghost:has-text("Restaurar")').click(); time.sleep(1.2)
    notes = pg.evaluate(KV, 'notes')['notes']
    ok('restaurar devuelve la nota', any('Bronquiolitis' in (n.get('inkText') or '') for n in notes), [n['title'] for n in notes])
    # Y la hoja que se quitó antes: sus trazos vuelven a la nota.
    pg.locator('.trash-list li:has-text("Hoja del lienzo")').first.locator('.btn.ghost:has-text("Restaurar")').click(); time.sleep(1.4)
    note_id = [n for n in notes if n.get('inkText')][0]['id']
    ink = pg.evaluate(INK, note_id)
    ok('restaurar la hoja devuelve sus trazos', bool(ink) and len(ink) >= 1, len(ink or []))
    ok('la papelera queda vacía', pg.locator('.trash-list li').count() == 0)
    pg.keyboard.press('Escape'); time.sleep(0.3)

    # Una sesión en el calendario, para que el .ics tenga algo que exportar.
    pg.click('.rail-btn:has-text("Calendario")'); pg.wait_for_selector('.week')
    pg.locator('.day.today .quick-add').fill('Repaso de bronquiolitis')
    pg.locator('.day.today .quick-add').press('Enter'); time.sleep(0.6)
    ok('sesión creada para el calendario', pg.locator('.day.today .session').count() >= 1)

    # ---------- 14. Exportar: paquete para el celular y .ics ----------
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Respaldo")')
    pg.wait_for_selector('.modal:has-text("Respaldo")')
    pg.click('button:has-text("Llevarlo a otro lado")'); pg.wait_for_selector('.modal:has-text("Llevarlo a otro lado")')
    with pg.expect_download() as dl:
        pg.click('button:has-text("Crear paquete de repaso")')
    pack = open(dl.value.path(), encoding='utf-8').read()
    ok('el paquete del celular es un HTML con la nota', pack.startswith('<!DOCTYPE html>') and 'Bronquiolitis' in pack and 'quiron' in dl.value.suggested_filename, dl.value.suggested_filename)
    ok('el paquete trae los resaltados y es de solo lectura', 'Resaltados' in pack and 'no regresa a la app' in pack)
    with pg.expect_download() as dl2:
        pg.click('button:has-text("Exportar plan")')
    ics = open(dl2.value.path(), encoding='utf-8').read()
    ok('el .ics es un calendario válido', ics.startswith('BEGIN:VCALENDAR') and ics.rstrip().endswith('END:VCALENDAR') and 'PRODID' in ics, ics[:60].replace('\r\n', ' '))

    errs2 = [e for e in errs if 'favicon' not in e and 'Failed to load resource' not in e]
    ok('sin errores de consola', not errs2, errs2[:3])
    b.close()
srv.shutdown()
print(f'SUMMARY {sum(1 for v in res.values() if v)} / {len(res)}')
