import threading, http.server, socketserver, functools, time, datetime, json
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4258),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':960})
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4258/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=20)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(1.0)

    def abrir():
        pg.click('.rail-btn:has-text("Herramientas")'); time.sleep(0.4)
        pg.click('.rail-pop button:has-text("Estrategia")'); pg.wait_for_selector('.modal'); time.sleep(0.6)
    abrir()
    txt = pg.inner_text('.modal')
    ok('abre la estrategia', 'Estrategia de estudio' in txt)
    ok('separa realidad de preferencias', 'Tu realidad' in txt and 'Cómo te gusta trabajar' in txt)
    ok('dice que las preferencias no cambian qué estudiar', 'no cambia qué estudiar' in txt, txt[:60])
    ok('no promete estilos de aprendizaje', 'estilo de aprendizaje' not in txt.lower() and 'visual, auditivo' not in txt.lower())
    ok('no deja analizar sin responder', pg.is_disabled('.modal button:has-text("Proponer ajustes")'))
    ok('muestra qué sabe la app', 'Qué sabe la app de ti' in txt)

    # Responder todo eligiendo opciones que deben disparar reglas concretas
    opciones = {
      'tiempo':'Media hora, si acaso', 'postguardia':'Inservible: duermo', 'cuando':'De noche',
      'donde':'En el transporte', 'meta':'Llegar fuerte al ENARM', 'abandono':'Se me olvida',
      'formato':'Contestando preguntas', 'sesion':'Ratos cortos y frecuentes', 'compania':'Solo',
    }
    for lbl in opciones.values():
        pg.click(f'.strat-opts button:has-text("{lbl}")'); time.sleep(0.15)
    ok('ya se puede analizar', not pg.is_disabled('.modal button:has-text("Proponer ajustes")'))

    pg.click('.modal button:has-text("Proponer ajustes")'); time.sleep(3.0)
    txt = pg.inner_text('.modal')
    ok('sin clave de IA lo dice y propone igual', 'reglas de la app' in txt, txt[:120].replace('\n',' '))
    n = pg.locator('.prop-list li').count()
    ok('propone algo concreto', n >= 2, n)
    ok('el postguardia entra por lo que respondiste', 'postguardia' in txt.lower())
    ok('no aconseja bajar minutos sin datos de estudio', 'Bajar el objetivo diario' not in txt, txt[:150].replace('\n',' '))
    ok('nunca muestra un dato vacío', '— min' not in txt and 'null' not in txt)
    ok('cada propuesta trae su porqué', pg.locator('.prop-list p').count() == n)

    # Aplicar la del postguardia y comprobar que el plan cambió de verdad
    antes = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:internship')).config.postGuardiaFactor")
    fila = pg.locator('.prop-list li', has_text='postguardia').first
    if fila.count() == 0: fila = pg.locator('.prop-list li', has_text='Postguardia').first
    fila.locator('button').click(); time.sleep(1.2)
    desp = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:internship')).config.postGuardiaFactor")
    ok('aplicar cambia el plan de verdad', desp != antes and abs(desp - 0.2) < 0.01, f'{antes} → {desp}')
    ok('queda marcada como aplicada', 'Aplicado' in pg.inner_text('.prop-list'))

    ok('la app no truena al aplicar', len(errs) == 0, errs[:2])

    # Un motor puede devolver basura: no debe entrar tal cual
    pg.evaluate("""() => {
      const st = JSON.parse(localStorage.getItem('alq:settings') || '{}');
      st.aiProvider = 'claude'; st.apiKey = 'sk-ant-prueba'; st.model = 'claude-sonnet-5-5';
      localStorage.setItem('alq:settings', JSON.stringify(st));
    }""")
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(1.2)
    MALO = {'proposals': [
      {'title': 'Estudiar 9000 minutos', 'why': 'porque sí', 'kind': 'config', 'patch': {'dailyMinutes': 9000}},
      {'title': 'Enfoque imposible', 'why': 'dato', 'kind': 'config', 'patch': {'primaryShare': 5}},
      {'title': 'Borrar todo', 'why': 'dato', 'kind': 'wipe', 'patch': {'everything': True}},
      {'title': 'Campo inventado', 'why': 'dato', 'kind': 'config', 'patch': {'guardiaEvery': 9}},
      {'title': 'Vista inventada', 'why': 'dato', 'kind': 'tool', 'view': 'javascript:alert(1)'},
      {'title': '', 'why': 'sin titulo', 'kind': 'config', 'patch': {'dailyMinutes': 60}},
      {'title': 'Exigencia absurda', 'why': 'dato', 'kind': 'retention', 'retention': 3},
    ]}
    pg.evaluate("""(malo) => {
      const real = window.fetch;
      window.fetch = async (u, o) => {
        if (String(u).includes('anthropic') || String(u).includes('googleapis'))
          return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(malo) }] }), { status: 200 });
        return real(u, o);
      };
    }""", MALO)
    abrir()
    for lbl in opciones.values():
        pg.click(f'.strat-opts button:has-text("{lbl}")'); time.sleep(0.12)
    pg.click('.modal button:has-text("Proponer ajustes")'); time.sleep(3.0)
    txt = pg.inner_text('.modal')
    ok('descarta las acciones que no existen', 'Borrar todo' not in txt and 'Vista inventada' not in txt, txt[:160].replace('\n',' '))
    ok('descarta campos del plan que no se pueden tocar', 'Campo inventado' not in txt)
    ok('descarta propuestas sin título', 'sin titulo' not in txt)
    ok('deja pasar las que sí existen', 'Estudiar 9000 minutos' in txt)
    pg.locator('.prop-list li', has_text='9000').first.locator('button').click(); time.sleep(1.0)
    dm = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:internship')).config.dailyMinutes")
    ok('recorta los números fuera de rango', dm == 240, dm)
    pg.locator('.prop-list li', has_text='Enfoque imposible').first.locator('button').click(); time.sleep(1.0)
    ps = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:internship')).config.primaryShare")
    ok('recorta también las fracciones', ps == 0.9, ps)
    pg.locator('.prop-list li', has_text='Exigencia absurda').first.locator('button').click(); time.sleep(1.0)
    rt = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:settings')).retention")
    ok('la exigencia del repaso queda en su tope', rt == 0.95, rt)

    pg.click('.modal button:has-text("Volver al cuestionario")'); time.sleep(0.6)
    ok('se puede volver al cuestionario', 'Tu realidad' in pg.inner_text('.modal'))
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
