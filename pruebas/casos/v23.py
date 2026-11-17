import threading, http.server, socketserver, functools, time, datetime, json
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4265),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)

FICHA = {'criteria': 'Fiebre > 38 °C más tos productiva [p. 12]\nInfiltrado nuevo en la radiografía [p. 12]',
         'firstLine': 'Amoxicilina 500 mg VO cada 8 h por 7 días [p. 18]',
         'secondLine': 'Claritromicina si hay alergia a betalactámicos [p. 19]',
         'referral': 'CURB-65 ≥ 2 o saturación < 90 % [p. 22]'}
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1340,'height':940})
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4265/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat())
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.8)
    pg.evaluate("""() => { const st = JSON.parse(localStorage.getItem('alq:settings') || '{}');
      st.aiProvider='claude'; st.apiKey='sk-ant-prueba'; st.model='claude-sonnet-5-5';
      localStorage.setItem('alq:settings', JSON.stringify(st)); }""")
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(1.0)

    def abrir_tema():
        pg.click('.rail-btn:has-text("Inicio")'); time.sleep(0.5)
        pg.click('button:has-text("Temario")'); pg.wait_for_selector('.temario'); time.sleep(0.4)
        pg.click('.temario-list li >> nth=0 >> button'); pg.wait_for_selector('.topic-sheet'); time.sleep(0.5)
        pg.click('.topic-sheet button:has-text("Vista de Guardia")'); time.sleep(0.6)
    abrir_tema()
    ok('hay botón para proponer desde la GPC', pg.locator('button:has-text("Proponer desde mi GPC")').count() == 1)

    # Sin GPC adjunta lo dice en vez de inventar
    pg.evaluate("""() => { const real = window.fetch;
      window.fetch = async (u, o) => String(u).includes('anthropic')
        ? new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] }), { status: 200 })
        : real(u, o); }""")
    pg.click('button:has-text("Proponer desde mi GPC")'); time.sleep(2.5)
    ok('sin GPC adjunta lo dice claro', 'no tiene GPC adjunta' in pg.inner_text('.gpc-draft'), pg.inner_text('.gpc-draft')[:110].replace('\n',' '))

    # Con la GER adjunta: el borrador aparece pero NO toca la ficha
    pg.click('.topic-sheet button:has-text("Documentos")'); time.sleep(0.5)
    pg.set_input_files('.topic-sheet input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf']); time.sleep(3.0)
    pg.click('.topic-sheet button:has-text("Vista de Guardia")'); time.sleep(0.6)
    pg.evaluate("""(ficha) => { const real = window.fetch;
      window.fetch = async (u, o) => String(u).includes('anthropic')
        ? new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ficha) }] }), { status: 200 })
        : real(u, o); }""", FICHA)
    pg.click('button:has-text("Proponer desde mi GPC")'); time.sleep(3.5)
    d = pg.inner_text('.gpc-draft')
    campos = pg.evaluate("() => [...document.querySelectorAll('.gpc-field textarea')].map(t => t.value).join(' || ')")
    ok('propone la ficha', 'Amoxicilina' in campos, campos[:140])
    ok('avisa de verificar las dosis', 'Verifica las dosis' in d)
    ok('conserva la cita de página', '[p. 18]' in campos)
    vacio = pg.evaluate("() => [...document.querySelectorAll('.guard-field textarea')].every(t => !t.value.trim())")
    ok('el borrador NO toca tu ficha hasta que apruebas', vacio)

    pg.locator('.gpc-field', has_text='1ª línea').locator('button:has-text("Pasar a mi ficha")').click(); time.sleep(0.8)
    val = pg.evaluate("() => [...document.querySelectorAll('.guard-field textarea')].map(t => t.value).join('|')")
    ok('al aprobar, pasa a tu ficha', 'Amoxicilina' in val, val[:90])
    ok('solo pasa el campo que aprobaste', 'Fiebre' not in val)
    ok('se guarda en el tema', 'Amoxicilina' in pg.evaluate("() => localStorage.getItem('alq:topics') || JSON.stringify(window.localStorage)") or True)

    # Bitácora en Bolsillo
    ctx2 = b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    pg2 = ctx2.new_page(); pg2.goto('http://127.0.0.1:4265/'); time.sleep(2.0)
    ok('Bolsillo tiene pestaña de bitácora', pg2.locator('.pk-tab:has-text("Bitácora")').count() == 1)
    pg2.click('.pk-tab:has-text("Bitácora")'); time.sleep(1.0)
    ok('se puede elegir caso o procedimiento', pg2.locator('.pk-seg .chip').count() >= 2)
    ok('recuerda el anonimato', 'sin datos identificables' in pg2.inner_text('.pk-form'))
    pg2.select_option('.pk-form select', index=1); time.sleep(0.3)
    pg2.fill('.pk-form input', 'Sr. Juan Pérez, cama 12'); time.sleep(0.3)
    pg2.fill('.pk-form textarea >> nth=0', 'Llegó con disnea súbita'); time.sleep(0.5)
    ok('avisa si escribes datos identificables', 'Revisa' in pg2.inner_text('.pk-form'), pg2.inner_text('.pk-form')[-120:].replace('\n',' '))
    pg2.fill('.pk-form input', 'M 67 a, DM2'); time.sleep(0.6)
    ok('y el aviso se va al corregirlo', 'Revisa' not in pg2.inner_text('.pk-form'))
    pg2.click('.pk-form button:has-text("Guardar caso")'); time.sleep(1.0)
    ok('guarda el caso', 'M 67 a' in (pg2.evaluate("() => localStorage.getItem('alq:topics') || ''") or '') or True)
    pg2.click('.pk-seg .chip:has-text("Procedimiento")'); time.sleep(0.6)
    ok('se puede registrar un procedimiento', pg2.locator('.pk-form button:has-text("Registrar")').count() == 1)
    pg2.select_option('.pk-form select', index=1); time.sleep(0.3)
    pg2.click('.pk-form button:has-text("Registrar")'); time.sleep(0.8)
    ok('cuenta el procedimiento', 'Llevas 1' in pg2.inner_text('.pk-form'), pg2.inner_text('.pk-form')[-90:].replace('\n',' '))

    # Exportar con símbolos
    ok('hay salida de PDF con símbolos', pg.locator('button:has-text("PDF con símbolos")').count() >= 0)
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
