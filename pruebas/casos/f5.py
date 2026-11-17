import threading, http.server, socketserver, functools, time, json, datetime, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4194/'
if URL.startswith('http'):
    srv = Q(('127.0.0.1', 4194), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(typeof g.result === 'string' ? JSON.parse(g.result) : g.result ?? null); }; })"""
start = (datetime.date(2026, 11, 13) - datetime.timedelta(days=40)).isoformat()
TTS_MOCK = """
window.__spoken = [];
const synth = { speaking: false, paused: false, getVoices: () => [{ lang: 'es-MX', name: 'Sabina', default: true }],
  speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, pause() { this.paused = true; }, resume() { this.paused = false; } };
Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
window.SpeechSynthesisUtterance = function (t) { this.text = t; };
"""
QS = {'questions': [{'vignette': f'Masculino de {60+i} años con fiebre, tos productiva y estertores en base derecha; refiere además dolor lumbar. FR 26, SatO2 91%.',
                      'question': '¿Cuál es el siguiente paso más adecuado?',
                      'options': [{'text': 'Distractor A', 'why': 'No corresponde.'}, {'text': 'Opción correcta', 'why': 'Lo indica la GPC.'}, {'text': 'Distractor C', 'why': 'Es tardío.'}, {'text': 'Distractor D', 'why': 'Innecesario.'}],
                      'correct': 1, 'page': 3} for i in range(5)]}

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 13, 9, 0))
    pg.add_init_script(TTS_MOCK)
    pg.on('dialog', lambda d: d.accept())
    calls = []
    def api(route):
        body = json.loads(route.request.post_data or '{}'); calls.append(body)
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'content': [{'type': 'text', 'text': json.dumps(QS)}]}))
    pg.route('https://api.anthropic.com/**', api)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0', start); pg.fill('.setup input[type=number] >> nth=0', '60'); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card')
    # GER adjunta a Neumonía
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("GPC")'); pg.wait_for_selector('.temario')
    pg.fill('.temario input', 'neumonia adquirida'); pg.click('.temario-list li >> nth=0 >> button'); pg.wait_for_selector('.topic-sheet')
    pg.set_input_files('.topic-sheet input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf']); pg.wait_for_selector('.att'); pg.keyboard.press('Escape'); time.sleep(1.0)
    tid = [k for k, v in pg.evaluate(KV, 'topics')['info'].items() if v['attachments']][0]

    # ---------- 1. Simulacros ----------
    pg.click('.rail-btn:has-text("Simulacros")'); pg.wait_for_selector('.exam-page')
    pg.click('.exam-tabs button:has-text("Generar casos")')
    pg.fill('.exam-setup input[aria-label="API key"]', 'sk-ant-test'); pg.click('.exam-setup button:has-text("Guardar clave")')
    pg.select_option('.exam-setup select[aria-label="Tema"]', tid)
    pg.click('.exam-setup button:has-text("Generar")'); pg.wait_for_selector('.exam-msg', timeout=20000); time.sleep(1.0)
    ok('generation from the attached GPC (5 cases)', 'Listo: 5 casos' in pg.inner_text('.exam-msg'), pg.inner_text('.exam-msg'))
    sent = calls[0]['messages'][0]['content'] if calls else ''
    ok('prompt carries GPC text with page markers', '[p. 3]' in sent and 'ecocardiograf' in sent.lower() and 'ENARM' in calls[0]['system'], sent[:120])
    qs = pg.evaluate(KV, 'exam')['questions']
    ok('questions saved «por revisar» with citation page', len(qs) == 5 and all(not q['reviewed'] and q['cite']['page'] == 3 and q['topicId'] == tid for q in qs))
    pg.click('.exam-tabs button:has-text("Banco")'); time.sleep(0.2)
    pg.click('.bank-list li >> nth=0 >> button:has-text("Validar")'); time.sleep(1.0)
    ok('validate a question', sum(1 for q in pg.evaluate(KV, 'exam')['questions'] if q['reviewed']) == 1)
    pg.click('.exam-tabs button:has-text("Nuevo simulacro")')
    pg.click('.exam-setup .seg button:has-text("Todo el banco")'); pg.select_option('.exam-setup select >> nth=0', '10')
    pg.click('.exam-setup button:has-text("Empezar")'); pg.wait_for_selector('.runner')
    ok('timer + 5 questions', pg.locator('.rdot').count() == 5 and '05:00' in pg.inner_text('.chip.timer') or '04:5' in pg.inner_text('.chip.timer'), pg.inner_text('.runner-top'))
    letters = pg.locator('.case-opt b').all_inner_texts()
    ok('options shuffled but lettered A–D', letters == ['A', 'B', 'C', 'D'])
    for k in range(5):
        pg.click('.case-opt:has-text("Distractor A")')
        if k < 4: pg.click('.runner-nav button:has-text("Siguiente")')
    ok('no feedback during exam mode', pg.locator('.case-opt.correct').count() == 0)
    pg.click('.runner-top button:has-text("Terminar")'); time.sleep(0.4)
    ok('results: 0 of 5 + correct shown + explanation + cite', '0' in pg.inner_text('.chip.result') and pg.locator('.case-opt.correct').count() == 1 and pg.locator('.case-why').count() == 4 and pg.locator('.runner .link:has-text("p. 3")').count() == 1, pg.inner_text('.chip.result'))
    ok('breakdown by specialty', pg.locator('.bk-row').count() == 1)
    pg.screenshot(path='/tmp/tc/shots/f5-exam.png')
    pg.click('.modal-head button[aria-label="Cerrar"]') if pg.locator('.modal-head button[aria-label="Cerrar"]').count() else pg.keyboard.press('Escape')
    time.sleep(1.0)
    ok('attempt saved', len(pg.evaluate(KV, 'exam')['attempts']) == 1)
    # modo estudio: explicación inmediata
    pg.click('.exam-setup .seg button:has-text("Estudio")'); pg.click('.exam-setup button:has-text("Empezar")'); pg.wait_for_selector('.runner')
    pg.click('.case-opt:has-text("Opción correcta")'); time.sleep(0.2)
    ok('study mode: immediate explanation', pg.locator('.case-opt.correct').count() == 1 and pg.locator('.case-why').count() == 4)
    pg.click('.runner-top button:has-text("Terminar")'); pg.once('dialog', lambda d: d.accept()) if False else None
    time.sleep(0.3)
    if pg.locator('.modal').count(): pg.keyboard.press('Escape')
    time.sleep(0.3)

    # ---------- 2. Debilidades + plan adaptativo ----------
    pg.click('.rail-btn:has-text("Progreso")'); pg.wait_for_selector('.mastery-card')
    ok('mastery map shows the topic as weak', pg.locator('.mcell.weak').count() >= 1, pg.locator('.mcell.weak').count())
    pg.click('.rail-btn:has-text("Inicio")'); pg.wait_for_selector('.weak-card')
    ok('Inicio lists weak topics', 'Neumonía' in pg.inner_text('.weak-card'), pg.inner_text('.weak-card')[:120])
    found = 'Refuerzo' in pg.inner_text('.day-card')
    for d in range(14, 21):
        if found: break
        pg.evaluate(f"() => [...document.querySelectorAll('.cal-cell')].find(b => !b.classList.contains('out') && b.textContent.trim().startsWith('{d}'))?.click()")
        time.sleep(0.15)
        found = 'Refuerzo' in pg.inner_text('.day-card')
    ok('reinforcement lesson added to the plan (next days)', found, pg.inner_text('.day-card')[:200])
    if pg.locator('button:has-text("Volver a hoy")').count(): pg.click('button:has-text("Volver a hoy")')
    pg.screenshot(path='/tmp/tc/shots/f5-inicio.png')

    # ---------- 3. Turno ----------
    pg.click('.rail-btn:has-text("Turno")'); pg.wait_for_selector('.ward-page')
    pg.click('.shift-chip button:has-text("Turno de 12 h")'); time.sleep(0.2)
    ok('shift timer', 'Termina en' in pg.inner_text('.shift-chip'), pg.inner_text('.shift-chip'))
    pg.click('.ward-page button:has-text("Agregar paciente")'); pg.wait_for_selector('.ward-card')
    card = '.ward-card >> nth=0'
    pg.fill(f'{card} >> input[aria-label="Cama o alias"]', '12'); pg.select_option(f'{card} >> select[aria-label="Sexo"]', 'masculino')
    pg.fill(f'{card} >> input[aria-label="Edad"]', '67'); pg.fill(f'{card} >> input[aria-label="Peso en kg"]', '70')
    pg.select_option(f'{card} >> select[aria-label="Tema"]', tid)
    pg.fill(f'{card} >> input[aria-label="Diagnóstico"]', 'NAC CURB-65 de 2')
    pg.fill(f'{card} >> input[aria-label="Nuevo pendiente"]', 'BH y PCR de control'); pg.keyboard.press('Enter')
    pg.select_option(f'{card} >> select[aria-label="Tipo de pendiente"]', 'ic'); pg.fill(f'{card} >> input[aria-label="Nuevo pendiente"]', 'Neumología'); pg.keyboard.press('Enter')
    time.sleep(0.2)
    ok('tasks with kinds + pending count', pg.locator(f'{card} >> .task-list li').count() == 2 and '2 pend.' in pg.inner_text(card))
    pg.click(f'{card} >> .task-list li >> nth=0 >> input[type=checkbox]'); time.sleep(0.1)
    ok('check a task', '1 pend.' in pg.inner_text(card))
    keys = pg.evaluate("Object.keys(localStorage)")
    ok('ward stored outside backups (no «alq:» prefix)', 'qc:ward' in keys)
    pg.click(f'{card} >> button:has-text("Nota SOAP")'); pg.wait_for_selector('.soap')
    st = pg.inner_text('.soap-text')
    ok('ward → SOAP prefilled', 'Paciente masculino de 67 años' in st and 'Neumonía' in st and 'Neumología' in st, st[:150])
    pg.keyboard.press('Escape')
    # ---------- 6. Fármacos por peso ----------
    pg.click(f'{card} >> button:has-text("Dosis")'); pg.wait_for_selector('.drug-panel')
    ok('weight carried to drug calculator', pg.input_value('.drug-kg input') == '70')
    pg.click('.drug-panel button:has-text("Ficha")')
    pg.fill('.drug-editor input[aria-label="Nombre del fármaco"]', 'Amoxicilina')
    pg.fill('.drug-editor input[aria-label="mg de la presentación"]', '250'); pg.fill('.drug-editor input[aria-label="mL de la presentación"]', '5')
    pg.fill('.drug-editor input[aria-label="mg por kg"]', '50'); pg.select_option('.drug-editor select[aria-label="Base de la dosis"]', 'day')
    pg.fill('.drug-editor input[aria-label="Divisiones"]', '3'); pg.fill('.drug-editor input[aria-label="Máximo por día"]', '3000')
    pg.fill('.drug-editor input[aria-label="Fuente"]', 'GPC de prueba p. 3')
    pg.click('.drug-editor button:has-text("Guardar ficha")'); time.sleep(0.3)
    r = pg.inner_text('.drug-list li >> nth=0')
    ok('dose by weight capped at your max/day (3500 → 3000 mg/día = 1000 mg = 20 mL)', '1000 mg' in r and '20 mL' in r and '3000' in r, r.replace('\n', ' | ')[:200])
    ok('cap warning shown', 'rebasa' in r)
    pg.fill('.drug-kg input', '20'); time.sleep(0.1)
    r = pg.inner_text('.drug-list li >> nth=0')
    ok('20 kg → 333.3 mg/dosis = 6.67 mL', '333.3 mg' in r and '6.67 mL' in r, r.replace('\n', ' | ')[:160])
    pg.screenshot(path='/tmp/tc/shots/f5-drugs.png')
    pg.keyboard.press('Escape')
    # cerrar turno → bitácora
    pg.click('.shift-chip button:has-text("Terminar turno")'); pg.wait_for_selector('.end-list')
    pg.click('.modal button:has-text("Cerrar turno y borrar la lista")'); time.sleep(1.0)
    cases = pg.evaluate(KV, 'topics')['info'][tid]['cases']
    ok('end shift → anonymous case in bitácora, list wiped', len(cases) == 1 and cases[0]['patient'] == 'M 67 a' and pg.locator('.ward-card').count() == 0, cases[:1])
    # caducidad automática
    pg.click('.ward-page button:has-text("Agregar paciente")'); time.sleep(0.3)
    pg.evaluate("() => { const v = JSON.parse(localStorage.getItem('qc:ward')); v.endsAt = Date.now() - 1000; localStorage.setItem('qc:ward', JSON.stringify(v)); }")
    pg.reload(); pg.wait_for_selector('.rail'); time.sleep(0.6)
    ok('list expires by itself after the shift', json.loads(pg.evaluate("localStorage.getItem('qc:ward')") or '{}').get('patients', []) == [])

    # ---------- 4. Búsqueda global ----------
    pg.keyboard.press('Control+k'); pg.wait_for_selector('.search-box')
    pg.fill('.search-input input', 'colangitis'); time.sleep(0.6)
    ok('search: HY pearls', 'perlas hy' in pg.inner_text('.search-results').lower())
    pg.fill('.search-input input', 'ecocardiograf'); pg.wait_for_selector('.search-hit:has-text("p. ")', timeout=20000); time.sleep(0.3)
    txt = pg.inner_text('.search-results')
    ok('search inside PDF pages (indexed)', 'pdfs' in txt.lower() and 'GER' in txt and pg.locator('.search-hit mark').count() >= 1, txt[:160])
    pg.fill('.search-input input', 'neumonia'); time.sleep(0.6)
    t3 = pg.inner_text('.search-results').lower()
    pg.fill('.search-input input', 'estertores'); time.sleep(0.6)
    t4 = pg.inner_text('.search-results').lower()
    ok('search: topics + exam questions', 'temas' in t3 and 'preguntas de simulacro' in t4, t3[:100])
    pg.keyboard.press('Escape'); time.sleep(0.2)
    pg.keyboard.press('Control+k'); pg.fill('.search-input input', 'ecocardiograf'); pg.wait_for_selector('.search-hit:has-text("p. ")', timeout=8000)
    pg.click('.search-hit:has-text("p. ") >> nth=0'); time.sleep(1.0)
    ok('PDF hit opens the page in Estudio', pg.evaluate("document.documentElement.dataset.view") == 'study')
    kvs = pg.evaluate("() => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').getAllKeys(); g.onsuccess = () => r(g.result); }; })")
    ok('PDF text index persisted (not as text: kept out of backups)', any(k.startswith('search:') for k in kvs))

    # ---------- 5. Escuchar ----------
    pg.click('.rail-btn:has-text("Perlas HY")'); pg.wait_for_selector('.hy-page')
    pg.click('.hy-page button:has-text("Escuchar")'); pg.wait_for_selector('.tts-bar'); time.sleep(0.6)
    spoken = pg.evaluate('window.__spoken')
    ok('read aloud with Spanish voice, item by item', len(spoken) >= 3 and 'Tríada de Charcot' in spoken[0] or any('Charcot' in s for s in spoken), spoken[:2])
    pg.click('.tts-bar button[aria-label="Detener lectura"]'); time.sleep(0.2)
    ok('stop', pg.locator('.tts-bar').count() == 0)
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.4)
    if pg.locator('.notes-panel button[aria-label="Escuchar esta nota"]').count():
        n0 = len(pg.evaluate('window.__spoken'))
        pg.click('.notes-panel button[aria-label="Escuchar esta nota"]'); time.sleep(0.5)
        ok('read a note aloud', len(pg.evaluate('window.__spoken')) > n0)
        pg.click('.tts-bar button[aria-label="Detener lectura"]') if pg.locator('.tts-bar').count() else None

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
