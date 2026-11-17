import threading, http.server, socketserver, functools, time, json, datetime, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4196/'
if URL.startswith('http'):
    srv = Q(('127.0.0.1', 4196), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
import os
SHOTS = os.environ.get('SHOTS')
def shot(pg, n):
    if SHOTS: pg.screenshot(path=f'/tmp/tc/shots/v5-{n}.png')
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(typeof g.result === 'string' ? JSON.parse(g.result) : g.result ?? null); }; })"""
INK_KEYS = """() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('ink').objectStore('ink').getAllKeys(); g.onsuccess = () => r(g.result); }; })"""
INK = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('ink').objectStore('ink').get(k); g.onsuccess = () => r(g.result ?? null); }; })"""
start = (datetime.date(2026, 11, 13) - datetime.timedelta(days=40)).isoformat()
NOTIFY_MOCK = """
window.__notes = [];
window.Notification = function (t, o) { window.__notes.push(t + '|' + ((o && o.body) || '')); };
window.Notification.permission = 'granted';
window.Notification.requestPermission = async () => 'granted';
"""
QS = {'questions': [{'vignette': f'Masculino de {60+i} años con fiebre, tos productiva y estertores en base derecha. FR 26, SatO2 91%.',
                      'question': '¿Cuál es el siguiente paso más adecuado?',
                      'options': [{'text': 'Distractor A', 'why': 'No.'}, {'text': 'Opción correcta', 'why': 'GPC.'}, {'text': 'Distractor C', 'why': 'No.'}, {'text': 'Distractor D', 'why': 'No.'}],
                      'correct': 1, 'page': 2} for i in range(4)]}
MN = {'mnemonics': [{'title': 'CURB', 'text': 'Confusión, Urea, Respiración, Baja presión', 'explain': 'Gravedad de la neumonía.'},
                    {'title': 'FIEBRE', 'text': 'Prueba', 'explain': 'Otra.'}]}
DG = {'title': 'Neumonía: abordaje', 'nodes': [{'id': 'a', 'label': 'Sospecha clínica', 'kind': 'start'}, {'id': 'b', 'label': '¿Criterios de gravedad?', 'kind': 'decision'},
      {'id': 'c', 'label': 'Manejo ambulatorio', 'kind': 'end'}, {'id': 'd', 'label': 'Hospitalizar', 'kind': 'end'}, {'id': 'x', 'label': 'huérfano', 'kind': 'raro'}],
      'edges': [{'from': 'a', 'to': 'b'}, {'from': 'b', 'to': 'c', 'label': 'No'}, {'from': 'b', 'to': 'd', 'label': 'Sí'}, {'from': 'b', 'to': 'zz'}]}

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 13, 9, 0))
    pg.add_init_script(NOTIFY_MOCK)
    pg.on('dialog', lambda d: d.accept())
    calls = []
    def api(route):
        body = json.loads(route.request.post_data or '{}'); calls.append(body); sysm = body.get('system', '')
        out = MN if 'mnemotecnias' in sysm else DG if 'algoritmo clínico' in sysm else QS
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': [{'type': 'text', 'text': json.dumps(out)}]}))
    pg.route('https://api.anthropic.com/**', api)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0', start); pg.fill('.setup input[type=number] >> nth=0', '60'); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card')

    def open_topic(q):
        pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("GPC")'); pg.wait_for_selector('.temario')
        pg.fill('.temario input', q); pg.click('.temario-list li >> nth=0 >> button'); pg.wait_for_selector('.topic-sheet')

    open_topic('neumonia adquirida')
    pg.set_input_files('.topic-sheet input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf']); pg.wait_for_selector('.att'); time.sleep(0.5)
    ok('single attachment: no compare button', pg.locator('.topic-sheet button:has-text("Comparar lado a lado")').count() == 0)
    pg.set_input_files('.topic-sheet input[type=file]', ['/tmp/tc/043GRR_Neumonia.pdf']); pg.wait_for_function("document.querySelectorAll('.att').length === 2"); time.sleep(0.8)
    tid = [k for k, v in pg.evaluate(KV, 'topics')['info'].items() if v['attachments']][0]

    # ---------- 9. Comparador ----------
    pg.click('.topic-sheet button:has-text("Comparar lado a lado")'); pg.wait_for_selector('.compare-overlay')
    pg.wait_for_function("document.querySelectorAll('.compare-overlay .pdf-scroll').length === 2 && [...document.querySelectorAll('.compare-overlay .pdf-page > canvas')].some(c => c.width > 0)", timeout=15000); time.sleep(1.2)
    shot(pg, 'compare')
    names = pg.eval_on_selector_all('.cmp-pane > select', 'els => els.map(e => e.options[e.selectedIndex].text)')
    ok('compare opens both guides', len(names) == 2 and names[0] != names[1], names)
    pg.evaluate("() => { const s = document.querySelectorAll('.compare-overlay .pdf-scroll')[0]; s.scrollTop = (s.scrollHeight - s.clientHeight) * 0.5; s.dispatchEvent(new Event('scroll')); }"); time.sleep(0.6)
    r = pg.evaluate("() => [...document.querySelectorAll('.compare-overlay .pdf-scroll')].map(s => s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight))")
    ok('scroll is synchronized proportionally', abs(r[0] - r[1]) < 0.06 and r[1] > 0.3, r)
    pg.uncheck('.cmp-head input[type=checkbox]'); time.sleep(0.3)
    pg.evaluate("() => { const s = document.querySelectorAll('.compare-overlay .pdf-scroll')[0]; s.scrollTop = 0; s.dispatchEvent(new Event('scroll')); }"); time.sleep(0.5)
    r2 = pg.evaluate("() => [...document.querySelectorAll('.compare-overlay .pdf-scroll')].map(s => s.scrollTop)")
    ok('sync can be turned off', r2[0] == 0 and r2[1] > 0, r2)
    pg.click('.cmp-head button[aria-label="Cerrar comparador"]'); time.sleep(0.3)
    ok('compare closes', pg.locator('.compare-overlay').count() == 0)

    # ---------- 8 / 18. Lectura y páginas clave ----------
    open_topic('neumonia adquirida')
    pg.click('.att.kind-GER button:has-text("Abrir")'); pg.wait_for_function("[...document.querySelectorAll('.pdf-page > canvas')].some(c => c.width > 0)", timeout=15000)
    time.sleep(9)
    lib = pg.evaluate(KV, 'library'); ger = [d for d in lib['docs'] if 'GER' in d['name']][0]
    ok('page counted as read after 8 s', len(lib.get('read', {}).get(ger['id'], [])) >= 1, lib.get('read'))
    ok('read % chip in toolbar', pg.locator('.pdf-workspace .read-chip').count() == 1 and '%' in pg.inner_text('.pdf-workspace .read-chip'))
    pg.click('.pdf-workspace button[title^="Marcar la p."]'); time.sleep(0.2)
    pg.click('[data-bm-toggle]'); pg.wait_for_selector('.bm-menu')
    pg.select_option('.bm-menu select.bm-kind', 'algoritmo'); time.sleep(1.0)
    bm = pg.evaluate(KV, 'library')['bookmarks'][ger['id']]
    ok('bookmark tagged as key page (algoritmo)', bm and bm[0].get('kind') == 'algoritmo', bm)
    pg.keyboard.press('Escape'); pg.mouse.click(700, 500)

    # ---------- 16. Preguntas desde subrayados ----------
    cur = pg.input_value('.pdf-workspace input[aria-label="Ir a página"]')
    ok('compare did not move «retomar» of the GER', cur == '1', cur)
    box = pg.locator(f'.pdf-page[data-page="{cur}"]').bounding_box()
    pg.click('button[aria-label="Resaltar área"]')
    pg.mouse.move(box['x'] + box['width'] * 0.08, box['y'] + box['height'] * 0.08); pg.mouse.down()
    pg.mouse.move(box['x'] + box['width'] * 0.92, box['y'] + box['height'] * 0.45, steps=6); pg.mouse.up(); time.sleep(0.8)
    pg.click('button[aria-label="Navegar"]')
    hls = pg.evaluate(KV, 'library')['highlights'].get(ger['id'], [])
    ok('highlight with text', hls and len(hls[0]['text']) > 12, [h['text'][:40] for h in hls])
    pg.click('.pdf-workspace [data-more-toggle]'); pg.click('.more-menu button:has-text("Preguntas con IA")'); pg.wait_for_selector('.modal:has-text("Preguntas desde tus subrayados")')
    ok('API key asked when missing', pg.locator('.modal button:has-text("Preguntarme")').is_disabled())
    pg.fill('.modal input[aria-label="API key"]', 'sk-ant-test'); pg.click('.modal button:has-text("Guardar clave")')
    n0 = len(calls)
    pg.click('.modal button:has-text("Preguntarme")'); pg.wait_for_selector('.runner', timeout=15000)
    sent = calls[n0]['messages'][0]['content']
    ok('highlight quiz prompt uses only the highlights with page', 'Subrayados' in sent and '[p. 1]' in sent and 'subrayó' in calls[n0]['system'], sent[:120])
    qs = pg.evaluate(KV, 'exam')['questions'] if False else None
    time.sleep(1.0); qs = pg.evaluate(KV, 'exam')['questions']
    ok('highlight questions in bank «por revisar», tied to the topic', len(qs) == 4 and all(not q['reviewed'] and q['topicId'] == tid for q in qs))
    ok('runner in study mode', pg.locator('.runner .case').count() == 1)
    # 19 dentro del runner
    pg.click('.runner .asked-btn'); time.sleep(1.0)
    ok('«me lo preguntaron» from the runner', sum(1 for q in pg.evaluate(KV, 'exam')['questions'] if q.get('asked')) == 1)
    pg.keyboard.press('Escape'); time.sleep(0.4)

    # ---------- 7. Diagrama ----------
    open_topic('neumonia adquirida')
    pg.click('.ts-sub button:has-text("Diagrama")'); pg.wait_for_selector('.diagram')
    n0 = len(calls)
    pg.click('.diagram button:has-text("Generar diagrama")'); pg.wait_for_selector('.diagram-img', timeout=15000)
    ok('diagram prompt carries GPC pages', '[p. ' in calls[n0]['messages'][0]['content'])
    shot(pg, 'diagram')
    ok('diagram sanitized (bad node kind / dangling edge)', pg.locator('.diagram-edit li').count() == 5 and pg.input_value('.diagram-edit li >> nth=4 >> select') == 'step')
    src0 = pg.get_attribute('.diagram-img', 'src')
    pg.fill('.diagram-edit li >> nth=0 >> input', 'Sospecha de NAC'); time.sleep(0.3)
    ok('editing a box re-renders the image', pg.get_attribute('.diagram-img', 'src') != src0 and src0.startswith('data:image/png'))
    pg.click('.modal button:has-text("Pegar en el lienzo de la nota")'); time.sleep(1.2)
    keys = [k for k in pg.evaluate(INK_KEYS) if k.endswith(':img')]
    imgs = pg.evaluate(INK, keys[0]) if keys else []
    ok('diagram pasted on the topic note canvas', len(imgs) == 1 and imgs[0]['src'].startswith('data:image/png'))
    ok('opens the canvas tab', pg.locator('.notes-panel .seg button[aria-selected="true"]').inner_text().strip().lower().startswith(('lienzo', 'a mano', 'mano', 'escrit')) or pg.locator('.notes-panel canvas').count() > 0)

    # ---------- 18 / 8 en la ficha ----------
    open_topic('neumonia adquirida'); time.sleep(0.3)
    ok('key-page chip in topic docs', pg.locator('.topic-sheet .key-chip:has-text("Algoritmo p. 1")').count() == 1)
    ok('read % and resume in topic docs', '% leído' in pg.inner_text('.att.kind-GER'))
    ok('note completeness chip in the sheet', pg.locator('.ts-sub .gap-chip').count() == 1 and 'Nota' in pg.inner_text('.ts-sub .gap-chip'))
    pg.keyboard.press('Escape')

    # ---------- 10 / 12. Plantillas y huecos ----------
    open_topic('apendicitis'); pg.click('.topic-sheet button:has-text("Estudiar")'); time.sleep(1.2)
    notes = pg.evaluate(KV, 'notes')['notes']
    ap = [n for n in notes if n['title'] == 'Apendicitis aguda']
    ok('surgery template', ap and 'Anatomía quirúrgica relevante' in ap[0]['html'] and 'Indicación quirúrgica' in ap[0]['html'])
    chip = pg.inner_text('.note-head .gap-chip')
    ok('gap detector: all sections empty', chip.startswith('0%') and '/10' in chip, chip)
    pg.click('.note-head .gap-chip'); ok('gap list shows missing sections', 'Anatomía quirúrgica' in pg.inner_text('.gap-pop'))
    open_topic('bronquiolitis'); pg.click('.topic-sheet button:has-text("Estudiar")'); time.sleep(1.2)
    bq = [n for n in pg.evaluate(KV, 'notes')['notes'] if n['title'] == 'Bronquiolitis']
    ok('pediatrics template', bq and 'Signos de alarma para los padres' in bq[0]['html'] and 'dosis por kg' in bq[0]['html'])
    open_topic('preeclampsia'); pg.click('.topic-sheet button:has-text("Estudiar")'); time.sleep(1.2)
    pe = [n for n in pg.evaluate(KV, 'notes')['notes'] if 'preeclampsia' in n['title']]
    ok('obstetrics template', pe and 'Vía de resolución del embarazo' in pe[0]['html'])
    # escribir en un apartado sube el %
    pg.click('.notes-panel .seg[role=tablist] button >> nth=0'); pg.wait_for_selector('.editor')
    pg.click('.editor h3:has-text("Factores de riesgo") + p'); pg.keyboard.type('Primigesta, edad materna avanzada'); pg.click('.note-title'); time.sleep(1.0)
    chip = pg.inner_text('.note-head .gap-chip')
    ok('gap detector updates as you write', chip.startswith('10%') and '1/10' in chip, chip)

    # ---------- 15. Mapa de GPC ----------
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("GPC")'); pg.wait_for_selector('.temario'); pg.fill('.temario input', '')
    pg.click('.temario button:has-text("Mapa GPC")'); pg.wait_for_selector('.gpc-map')
    shot(pg, 'map')
    ok('map: neumonía being read', pg.locator('.gm-tile.st-reading').count() == 1)
    ok('map: rest missing', pg.locator('.gm-tile.st-missing').count() > 50)
    head = pg.inner_text('.gm-sp >> nth=0 >> header')
    ok('map: per-specialty counts', 'con GPC' in head and 'faltan' in head, head)
    pg.keyboard.press('Escape')

    # ---------- 2 / 17. Bitácora ----------
    pg.click('.rail-btn:has-text("Bitácora")'); pg.wait_for_selector('.logbook-page')
    ok('rotation preselected from the plan', pg.input_value('.lb-form select[aria-label="Rotación"]') != '')
    pg.fill('.lb-form input[aria-label="Nota del procedimiento"]', 'Primer intento, con supervisión')
    pg.click('.lb-form button:has-text("Registrar")'); time.sleep(0.2)
    pg.click('.lb-form .seg button:has-text("asistí")'); pg.click('.lb-form button:has-text("Registrar")'); time.sleep(0.3)
    row = pg.inner_text('.lb-table tbody tr >> nth=0')
    ok('procedure counts by role', 'Venopunción' in row and row.count('1') >= 2, row)
    ok('goal inputs hidden until «Editar metas»', pg.locator('.lb-table input').count() == 0)
    pg.click('.lb-counts button:has-text("Editar metas")')
    pg.fill('.lb-table input[aria-label="Meta de Venopunción"]', '1'); pg.click('.lb-history h4'); pg.click('.lb-counts button:has-text("Listo")'); time.sleep(0.3)
    ok('target reached mark', pg.locator('.lb-table tr.reached').count() == 1 and '1/1' in pg.inner_text('.lb-table tbody tr >> nth=0'))
    pg.fill('.lb-form input[aria-label="Nuevo tipo de procedimiento"]', 'Punción lumbar'); pg.click('.lb-form button:has-text("Agregar")'); time.sleep(0.2)
    ok('custom procedure type', pg.input_value('.lb-form select[aria-label="Procedimiento"]') != 'pt-0' and pg.locator('.lb-table td:has-text("Punción lumbar")').count() == 1)
    pg.fill('.lb-form input[aria-label="Nota del procedimiento"]', 'Paciente Juan Pérez'); time.sleep(0.1)
    ok('privacy warning on names', pg.locator('.lb-form .privacy-warn').count() == 1)
    pg.fill('.lb-form input[aria-label="Nota del procedimiento"]', '')
    pg.click('.lb-tabs button:has-text("Diario")')
    pg.fill('textarea[aria-label="¿Qué aprendí hoy?"]', 'Explicar el pronóstico con calma.'); pg.fill('textarea[aria-label="¿Qué me costó?"]', 'La primera gasometría.')
    pg.click('button:has-text("Guardar entrada")'); time.sleep(0.3)
    pg.fill('textarea[aria-label="¿Qué haría distinto?"]', 'Preparar el material antes.'); pg.click('button:has-text("Guardar entrada")'); time.sleep(1.0)
    pg.click('.lb-tabs button:has-text("Procedimientos")'); time.sleep(0.2); shot(pg, 'logbook'); pg.click('.lb-tabs button:has-text("Diario")')
    lb = pg.evaluate(KV, 'logbook')
    ok('logbook persisted', len(lb['entries']) == 2 and {e['role'] for e in lb['entries']} == {'realicé', 'asistí'} and lb['entries'][0]['specialty'])
    ok('journal: one entry per day (updated)', len(lb['journal']) == 1 and lb['journal'][0]['differently'].startswith('Preparar'))

    # ---------- 14. Signos vitales ----------
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("Guardia")'); pg.click('.gq-tabs button:has-text("Signos vitales")'); pg.wait_for_selector('.vitals-table')
    ok('vitals table starts empty (no preloaded values)', pg.locator('.vitals-table .warn-text').count() == 1)
    pg.fill('input[aria-label="Lactante menor: FC (lpm) mínima"]', '100'); pg.fill('input[aria-label="Lactante menor: FC (lpm) máxima"]', '160'); pg.keyboard.press('Tab'); time.sleep(1.0)
    vg = [g for g in pg.evaluate(KV, 'vitals')['groups'] if g['id'] == 'lmen'][0]
    ok('vitals range saved', vg['fc'] == {'min': 100, 'max': 160}, vg['fc'])
    pg.click('.vitals-table button:has-text("Listo")'); time.sleep(0.1)
    ok('vitals read view', '100–160' in pg.inner_text('.vitals-table') and pg.locator('.vitals-table td input').count() == 0)
    pg.keyboard.press('Escape')

    # ---------- Turno: signos fuera de rango, hora, ensayo ----------
    pg.click('.rail-btn:has-text("Turno")'); pg.wait_for_selector('.ward-page')
    pg.click('button:has-text("Agregar paciente")'); card = '.ward-card >> nth=0'
    pg.fill(f'{card} >> input[aria-label="Cama o alias"]', '3'); pg.fill(f'{card} >> input[aria-label="Edad"]', '8 m')
    pg.fill(f'{card} >> input[aria-label="Diagnóstico"]', 'Bronquiolitis moderada')
    pg.fill(f'{card} >> input[aria-label="FC (lpm)"]', '190'); time.sleep(0.2)
    ok('vital out of range flagged', pg.locator(f'{card} >> .vital.out').count() == 1 and '↑' in pg.inner_text(f'{card} >> .vital.out'))
    pg.fill(f'{card} >> input[aria-label="FC (lpm)"]', '130'); time.sleep(0.1)
    ok('vital in range', pg.locator(f'{card} >> .vital.in').count() == 1 and pg.locator(f'{card} >> .vital.out').count() == 0)
    pg.fill(f'{card} >> input[aria-label="Nuevo pendiente"]', 'BH de control'); pg.fill(f'{card} >> input[aria-label="Hora del recordatorio (opcional)"]', '08:30')
    pg.click(f'{card} >> button[type=submit]'); time.sleep(0.2)
    ok('task time shown', pg.locator(f'{card} >> .task-at:has-text("08:30")').count() == 1)
    pg.click(f'{card} >> button:has-text("Ensayo")'); pg.wait_for_selector('.rounds')
    sc = pg.inner_text('.rounds-script')
    ok('rounds script from the card', 'Cama 3' in sc and 'Bronquiolitis moderada' in sc and 'FC 130' in sc and 'BH de control a las 08:30' in sc, sc[:160])
    shot(pg, 'rounds')
    pg.click('.rounds button:has-text("Empezar")'); ok('rounds timer runs', pg.locator('.rounds button:has-text("Pausa")').count() == 1)
    pg.click('.rounds .seg button:has-text("60 s")'); pg.keyboard.press('Escape'); time.sleep(0.3)

    # ---------- 1 / 13. Ajustes: recordatorios y modo noche ----------
    (pg.click('.rail-btn:has-text("Ajustes")') if not pg.locator('.rail-pop').count() else None); pg.click('.rail-pop button:has-text("Preferencias")'); pg.wait_for_selector('.prefs')
    pg.check('.prefs input[type=checkbox]'); time.sleep(0.5)
    notes_ = pg.evaluate('window.__notes')
    ok('ward task reminder fired once', any('Pendiente · 3' in n and '08:30 — BH de control' in n for n in notes_), notes_)
    pg.click('.prefs button:has-text("Probar")'); time.sleep(0.2)
    ok('test notification', len(pg.evaluate('window.__notes')) == len(notes_) + 1)
    ok('task marked notified', pg.evaluate("() => JSON.parse(localStorage.getItem('qc:ward')).patients[0].tasks[0].notified") is True)
    pg.click('.prefs button:has-text("Siempre")'); time.sleep(0.2)
    pg.keyboard.press('Escape'); pg.click('.rail-btn:has-text("Turno")'); time.sleep(0.3); shot(pg, 'night-ward'); (pg.click('.rail-btn:has-text("Ajustes")') if not pg.locator('.rail-pop').count() else None); pg.click('.rail-pop button:has-text("Preferencias")'); pg.wait_for_selector('.prefs')
    ok('night chip in top bar', pg.locator('.topbar .night-chip').count() == 1)
    ok('night mode on', pg.evaluate("document.documentElement.dataset.night") == 'on' and pg.evaluate("getComputedStyle(document.querySelector('.night-veil')).display") == 'block')
    pg.click('.prefs button:has-text("Automático")'); time.sleep(0.2)
    ok('night auto 22–6 is off at 9:00', pg.evaluate("document.documentElement.dataset.night") is None)
    pg.select_option('.prefs select[aria-label="Inicio del modo noche"]', '8'); pg.select_option('.prefs select[aria-label="Fin del modo noche"]', '10'); time.sleep(0.2)
    ok('night auto 8–10 is on at 9:00', pg.evaluate("document.documentElement.dataset.night") == 'on')
    pg.click('.prefs button:has-text("Apagado")'); pg.keyboard.press('Escape'); time.sleep(1.0)
    ok('night chip gone', pg.locator('.topbar .night-chip').count() == 0)
    ok('rail fits without scrolling', pg.evaluate("(() => { const r = document.querySelector('.rail'); return r.scrollHeight <= r.clientHeight + 1; })()"))
    st = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:settings'))")
    ok('settings persisted', st['reminders'] is True and st['night'] == 'off' and st['nightFrom'] == 8)

    # ---------- 11 / 19 / 5. Inicio ----------
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("Guardia")'); pg.click('.gq-tabs button:has-text("Fármacos por peso")'); pg.wait_for_selector('.drug-panel')
    pg.click('.drug-panel button:has-text("Ficha")')
    pg.fill('.drug-editor input[aria-label="Nombre del fármaco"]', 'Amoxicilina'); pg.fill('.drug-editor input[aria-label="mg por kg"]', '50')
    pg.select_option('.drug-editor select[aria-label="Base de la dosis"]', 'day'); pg.fill('.drug-editor input[aria-label="Divisiones"]', '3')
    pg.fill('.drug-editor input[aria-label="Fuente"]', 'GPC de prueba p. 3'); pg.click('.drug-editor button:has-text("Guardar ficha")'); time.sleep(0.3)
    pg.keyboard.press('Escape')
    pg.click('.rail-btn:has-text("Inicio")'); pg.wait_for_selector('.dod-card')
    shot(pg, 'home')
    ok('KPI strip', pg.locator('.kpi-strip .kpi').count() == 4 and 'pendientes del turno' in pg.inner_text('.kpi-strip'))
    pg.fill('.kpi-strip input[aria-label="Fecha del ENARM"]', '2027-09-13'); time.sleep(0.2)
    ok('ENARM countdown', '304' in pg.inner_text('.kpi-strip') and 'días para el ENARM' in pg.inner_text('.kpi-strip'), pg.inner_text('.kpi-strip'))
    pg.click('.card:has(h4:has-text("Rotaciones")) .fold-btn'); time.sleep(0.1)
    ok('fold card opens (rotations folded by default)', pg.locator('.timeline').count() == 1)
    ok('high priority as dot', pg.locator('.lesson .prio-dot').count() >= 1 and 'Prioridad alta' not in pg.inner_text('.lesson-list'))
    ok('drug of the day from your own cards', pg.inner_text('.dod-card .dod-name') == 'Amoxicilina' and '50 mg/kg/día en 3 tomas' in pg.inner_text('.dod-card'))
    pg.click('.dod-card button:has-text("Hacer flashcard")'); pg.wait_for_selector('.card-form')
    ok('drug flashcard prefilled', 'Amoxicilina' in pg.input_value('.card-form textarea >> nth=0') and 'Fuente: GPC de prueba' in pg.input_value('.card-form textarea >> nth=1'))
    pg.click('.modal button:has-text("Guardar")'); time.sleep(0.4)
    pg.click('.fc-card button:has-text("Repasar")'); pg.wait_for_selector('.flashcard')
    pg.click('.review-meta .asked-btn'); time.sleep(1.0)
    ok('flashcard tagged «me lo preguntaron»', pg.evaluate(KV, 'cards')['cards'][0].get('asked') is True)
    pg.keyboard.press('Escape'); time.sleep(0.3)
    ok('asked deck on Inicio', pg.locator('.fc-card button:has-text("Repasar preguntadas (1)")').count() == 1)
    pg.click('.week-card button:has-text("Ver")') if pg.locator('.week-card .week-grid').count() == 0 else None
    wk = pg.inner_text('.week-card')
    ok('weekly summary', 'flashcards' in wk and 'procedimientos' in wk and '2' in pg.inner_text('.week-grid span:has-text("procedimientos")'), wk[:120])
    with pg.expect_download() as dl:
        pg.click('.week-card button:has-text("Exportar PDF")')
    path = dl.value.path(); data = open(path, 'rb').read()
    ok('weekly summary exported to PDF', data[:4] == b'%PDF' and len(data) > 1500)

    # ---------- 19 / 4. Simulacros y Perlas HY ----------
    pg.click('.rail-btn:has-text("Simulacros")'); pg.wait_for_selector('.exam-page')
    ok('simulacro source «me lo preguntaron»', pg.locator('.exam-setup button:has-text("Me lo preguntaron (1)")').count() == 1)
    pg.click('.exam-setup button:has-text("Me lo preguntaron (1)")'); ok('asked pool', '1 preguntas disponibles' in pg.inner_text('.exam-setup'))
    pg.click('.exam-tabs button:has-text("Banco")'); pg.click('.card .seg button:has-text("Me lo preguntaron")'); time.sleep(0.2)
    ok('bank filter asked', pg.locator('.bank-list li').count() == 1)
    pg.click('.rail-btn:has-text("Perlas HY")'); pg.wait_for_selector('.hy-page')
    pg.click('.hy-item >> nth=0 >> .asked-btn'); time.sleep(0.2)
    pg.click('.hy-filters button:has-text("Preguntadas")'); time.sleep(0.2)
    ok('HY asked filter', pg.locator('.hy-item').count() == 1)
    pg.click('.hy-filters button:has-text("Preguntadas")')
    nhy = len(pg.evaluate(KV, 'hy')['items'])
    pg.click('.mnemo-open'); pg.wait_for_selector('.mnemo-gen')
    pg.select_option('.mnemo-gen select[aria-label="Tema"]', tid)
    n0 = len(calls); pg.click('.mnemo-gen button:has-text("Proponer")'); pg.wait_for_selector('.mnemo-list li', timeout=15000)
    ok('mnemonic prompt uses the GPC', 'mnemotecnias' in calls[n0]['system'] and '[p. ' in calls[n0]['messages'][0]['content'])
    ok('nothing saved until you choose', len(pg.evaluate(KV, 'hy')['items']) == nhy and pg.locator('.mnemo-gen button:has-text("Guardar elegidas")').is_disabled())
    pg.check('.mnemo-list li >> nth=0 >> input'); pg.click('.mnemo-gen button:has-text("Guardar elegidas")'); time.sleep(1.0)
    items = pg.evaluate(KV, 'hy')['items']
    ok('chosen mnemonic saved as HY mnemo', len(items) == nhy + 1 and any(i['kind'] == 'mnemo' and i['title'] == 'CURB' and i['topicId'] == tid for i in items))

    # ---------- 6. Respaldo cifrado ----------
    (pg.click('.rail-btn:has-text("Ajustes")') if not pg.locator('.rail-pop').count() else None); pg.click('.rail-pop button:has-text("Respaldo")'); pg.wait_for_selector('.backup')
    pg.fill('input[aria-label="Contraseña del respaldo"]', 'corta'); pg.fill('input[aria-label="Repetir contraseña"]', 'corta')
    ok('short password rejected', pg.locator('button:has-text("Activar cifrado")').is_disabled())
    pg.fill('input[aria-label="Contraseña del respaldo"]', 'secreta-123'); pg.fill('input[aria-label="Repetir contraseña"]', 'secreta-123')
    pg.click('button:has-text("Activar cifrado")'); time.sleep(0.3)
    shot(pg, 'backup')
    ok('encryption active', 'desbloqueado' in pg.inner_text('.enc-section'))
    with pg.expect_download() as dl:
        pg.click('button:has-text("Solo notas y progreso")')
    bpath = dl.value.path(); raw = open(bpath, encoding='utf-8').read(); bj = json.loads(raw)
    ok('backup file is encrypted', bj.get('enc') == 1 and bj.get('iter') >= 200000 and 'Venopunción' not in raw and 'logbook' not in raw and dl.value.suggested_filename.endswith('-cifrado.json'), dl.value.suggested_filename)
    ok('flag not inside the backup', 'alq:backupEnc' not in raw)
    pg.fill('input[aria-label="Contraseña del respaldo"]', 'equivocada-1')
    pg.set_input_files('.backup input[type=file]', bpath); time.sleep(2.5)
    ok('wrong password refused', 'Contraseña incorrecta' in pg.inner_text('.backup'))
    # Borra la bitácora para comprobar que se restaura.
    pg.evaluate("() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const tx = q.result.transaction('kv','readwrite'); tx.objectStore('kv').delete('logbook'); tx.oncomplete = r; }; })")
    ok('logbook wiped before restore', pg.evaluate(KV, 'logbook') is None)
    pg.fill('input[aria-label="Contraseña del respaldo"]', 'secreta-123')
    with pg.expect_navigation(timeout=15000):
        pg.set_input_files('.backup input[type=file]', bpath)
    pg.wait_for_selector('.rail'); time.sleep(1.0)
    lb2 = pg.evaluate(KV, 'logbook')
    ok('encrypted backup restores', len(lb2['entries']) == 2 and len(lb2['journal']) == 1)
    (pg.click('.rail-btn:has-text("Ajustes")') if not pg.locator('.rail-pop').count() else None); pg.click('.rail-pop button:has-text("Respaldo")'); pg.wait_for_selector('.backup')
    ok('after reload: encrypted but locked', 'bloqueado' in pg.inner_text('.enc-section'))
    pg.fill('input[aria-label="Contraseña del respaldo"]', 'secreta-123'); pg.click('.enc-section button:has-text("Desbloquear")'); time.sleep(0.2)
    ok('unlock for the session', 'desbloqueado' in pg.inner_text('.enc-section'))
    pg.keyboard.press('Escape')

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
