import threading, http.server, socketserver, functools, time, json, datetime, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4191/'
if URL.startswith('http'):
    srv = Q(('127.0.0.1', 4191), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:160]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(g.result ? JSON.parse(g.result) : null); }; })"""
start = (datetime.date(2026, 11, 13) - datetime.timedelta(days=40)).isoformat()
STUB = "() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; }"

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    if URL.startswith('http'): ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=URL.rstrip('/'))
    pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 13, 9, 0))
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0', start); pg.fill('.setup input[type=number] >> nth=0', '60'); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card')
    pg.evaluate(STUB)

    # ---------- Perlas HY ----------
    pg.click('.rail-btn:has-text("Perlas HY")'); pg.wait_for_selector('.hy-page')
    ok('HY seeds loaded (classic eponyms)', pg.locator('.hy-item').count() == 20, pg.locator('.hy-item').count())
    pg.fill('.hy-page input[aria-label="Buscar perlas"]', 'colangitis'); time.sleep(0.2)
    ok('search without accents finds Charcot + Reynolds', pg.locator('.hy-item').count() == 2, pg.locator('.hy-item b').all_inner_texts())
    pg.fill('.hy-page input[aria-label="Buscar perlas"]', '')
    pg.click('.hy-add'); pg.select_option('.hy-editor select[aria-label="Tipo"]', 'mnemo')
    pg.fill('.hy-editor input[aria-label="Nombre"]', 'SAD PUCKER')
    pg.fill('.hy-editor textarea[aria-label="Perla"]', 'Causas de pancreatitis aguda')
    pg.fill('.hy-editor textarea[aria-label="Explicación"]', 'Esteroides, Alcohol, Drogas…')
    val = pg.evaluate("() => [...document.querySelector('.hy-editor select[aria-label=\"Tema\"]').options].find(o => /pancreatitis/i.test(o.text))?.value")
    pg.select_option('.hy-editor select[aria-label="Tema"]', val)
    pg.click('.hy-editor button:has-text("Guardar")'); time.sleep(0.6)
    items = pg.evaluate(KV, 'hy')['items']
    ok('new mnemonic saved with topic', items[0]['title'] == 'SAD PUCKER' and items[0]['kind'] == 'mnemo' and items[0]['topicId'], items[0])
    pg.click('.hy-item >> nth=0 >> .hy-star'); pg.click('.hy-filters button:has-text("Favoritas")'); time.sleep(0.2)
    ok('star + favorites filter', pg.locator('.hy-item').count() == 1)
    pg.click('.hy-filters button:has-text("Favoritas")')
    pg.click('.hy-item >> nth=0 >> button[aria-label="Convertir en flashcard"]'); pg.wait_for_selector('.card-form')
    time.sleep(0.3); print('DBG', pg.input_value('.card-form textarea >> nth=0'), '|', pg.input_value('.card-form textarea >> nth=1'))
    ok('HY → flashcard prefilled', 'SAD PUCKER' in pg.input_value('.card-form textarea >> nth=0') and 'Esteroides' in pg.input_value('.card-form textarea >> nth=1'))
    pg.keyboard.press('Escape')
    with pg.expect_download() as dl: pg.click('.hy-page button:has-text("Exportar")')
    path = dl.value.path(); exported = json.load(open(path))
    ok('export shares only your own pearls', len(exported) == 1 and exported[0]['title'] == 'SAD PUCKER', len(exported))
    open('/tmp/tc/share.json', 'w').write(json.dumps(exported + [{'kind': 'triada', 'title': 'Tríada de Saint', 'text': 'Hernia hiatal + colelitiasis + diverticulosis'}, {'text': 42}]))
    pg.set_input_files('.hy-page input[type=file]', '/tmp/tc/share.json'); time.sleep(0.6)
    ok('import dedupes and ignores invalid rows', pg.locator('.hy-item').count() == 22 and '1 perla nueva' in pg.inner_text('.toast'), pg.locator('.hy-item').count())
    pg.click('.hy-page button:has-text("Repaso relámpago")'); pg.click('.hy-quiz-card'); time.sleep(0.2)
    ok('quick quiz reveals the pearl', pg.locator('.hy-quiz .fc-back').count() == 1)
    pg.screenshot(path='/tmp/tc/shots/f3-02-hy.png')

    # ---------- Perla HY desde el PDF ----------
    pg.click('.rail-btn:has-text("Inicio")'); pg.click('button:has-text("Temario")')
    pg.fill('.temario input', 'pancreatitis aguda'); pg.click('.temario-list li >> nth=0 >> button'); pg.wait_for_selector('.topic-sheet')
    pg.set_input_files('.topic-sheet input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf']); pg.wait_for_selector('.att')
    pg.click('.ts-tabs button:has-text("Perlas HY")'); time.sleep(0.2)
    ok('topic sheet HY tab shows its pearls', 'SAD PUCKER' in pg.inner_text('.topic-sheet') and 'Cullen' in pg.inner_text('.topic-sheet'))
    pg.click('.ts-tabs button:has-text("Vista de Guardia")')
    pg.fill('.guard-field:has-text("Criterios") textarea', 'Dolor abdominal típico\nLipasa ≥ 3 veces el límite superior\nImagen compatible')
    pg.fill('.guard-field:has-text("1ª línea") textarea', 'Reanimación hídrica según GPC')
    pg.fill('.guard-field:has-text("referencia") textarea', 'Falla orgánica persistente → UCI')
    time.sleep(0.6)
    pg.click('.topic-sheet .btn:has-text("Estudiar")'); pg.wait_for_selector('.pdf-page')
    pg.wait_for_function("() => document.querySelectorAll('.pdf-page[data-page=\"1\"] .textLayer span').length > 3", timeout=10000)
    bb = pg.locator('.pdf-page[data-page="1"] .textLayer span').nth(2).bounding_box()
    pg.mouse.move(bb['x'] + 2, bb['y'] + bb['height'] / 2); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.8, bb['y'] + bb['height'] / 2, steps=8); pg.mouse.up()
    pg.wait_for_selector('.pearl-menu')
    ok('pearl menu has 7 actions incl. Tapar', pg.locator('.pearl-btn').count() == 7)
    pg.click('.pearl-btn:has-text("Perla HY")'); time.sleep(0.7)
    it = pg.evaluate(KV, 'hy')['items'][0]
    ok('PDF selection → HY pearl with page source', it['source'] and it['source']['page'] == 1 and it['topicId'], it.get('source'))

    # ---------- Nota médica ----------
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("Nota SOAP")'); pg.wait_for_selector('.soap')
    val = pg.evaluate("() => [...document.querySelector('.soap select[aria-label=\"Tema\"]').options].find(o => /pancreatitis aguda/i.test(o.text))?.value")
    pg.select_option('.soap select[aria-label="Tema"]', val)
    pg.select_option('.soap-grid select', 'femenino')
    vals = {'Edad': '45', 'Servicio': 'Cirugía General', 'Día de estancia': '2', 'TA (mmHg)': '118/76', 'FC': '92', 'FR': '18', 'Temp': '37.2', 'SatO': '96'}
    for k, v in vals.items(): pg.fill(f'.soap-grid label:has-text("{k}") input', v)
    pg.fill('.soap-form label:has-text("S · Subjetivo") textarea', 'Refiere disminución del dolor abdominal, tolera líquidos.')
    pg.fill('.soap-form label:has-text("Pronóstico") textarea', 'Bueno para la vida y la función.')
    txt = pg.inner_text('.soap-text')
    ok('SOAP fills patient data + vitals', 'Paciente femenino de 45 años' in txt and 'TA 118/76 mmHg' in txt and 'FC 92 lpm' in txt, txt[:200])
    ok('SOAP pulls GPC criteria/plan/alarms from the guard card', '• Lipasa ≥ 3 veces' in txt and '• Reanimación hídrica según GPC' in txt and '• Falla orgánica persistente' in txt)
    ok('NOM-004 sections present (fecha, hora, pronóstico, firma)', all(k in txt for k in ['Fecha: 13/11/2026', 'Hora:', 'Pronóstico: Bueno', 'Cédula']), txt[-200:])
    ok('blanks are marked and counted', '___' in txt and pg.locator('.soap-out .chip').count() == 1, pg.inner_text('.soap-out .chip'))
    pg.click('.soap-out button:has-text("Copiar nota")'); time.sleep(0.3)
    if URL.startswith('http'):
        ok('copy to clipboard', 'NOTA DE EVOLUCIÓN' in pg.evaluate('navigator.clipboard.readText()'))
    pg.fill('.soap-form label:has-text("A · Análisis") textarea', 'Paciente Rosa Martínez evoluciona bien, cama 14')
    ok('privacy warning on names/bed', pg.locator('.soap .privacy-warn').count() == 1)
    pg.fill('.soap-form label:has-text("A · Análisis") textarea', 'Evolución favorable, sin datos de falla orgánica.')
    pg.select_option('.soap select[aria-label="Tipo de nota"]', 'postqx')
    ok('post-op template shows surgery field', pg.locator('.soap-form label:has-text("Cirugía realizada")').count() == 1 and 'NOTA POSTQUIRÚRGICA' in pg.inner_text('.soap-text'))
    pg.click('.soap-out button:has-text("Editar plantilla")')
    tpl = pg.input_value('.soap-out textarea')
    pg.fill('.soap-out textarea', tpl.replace('NOTA POSTQUIRÚRGICA', 'NOTA POSTQUIRÚRGICA · HGZ'))
    pg.click('.soap-out button:has-text("Guardar plantilla")'); time.sleep(0.4)
    ok('custom template saved', 'NOTA POSTQUIRÚRGICA · HGZ' in pg.inner_text('.soap-text') and 'HGZ' in (pg.evaluate("localStorage.getItem('alq:soap')") or ''))
    pg.screenshot(path='/tmp/tc/shots/f3-03-soap.png')
    pg.keyboard.press('Escape')
    pg.reload(); pg.wait_for_selector('.rail'); time.sleep(0.6)
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("Nota SOAP")'); pg.wait_for_selector('.soap')
    ok('patient data NOT persisted after reload', '45 años' not in pg.inner_text('.soap-text'))
    pg.select_option('.soap select[aria-label="Tipo de nota"]', 'postqx')
    ok('template persisted after reload', 'HGZ' in pg.inner_text('.soap-text'))
    pg.keyboard.press('Escape')
    kv = pg.evaluate("() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').getAllKeys(); g.onsuccess = () => r(g.result); }; })")
    ok('new data included in backup (kv: hy)', 'hy' in kv and 'sources' not in kv, kv)
    ok('no NotebookLM UI left', pg.locator('.rail-btn:has-text("Fuentes")').count() == 0 and pg.locator('.nlm-btn').count() == 0)

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
