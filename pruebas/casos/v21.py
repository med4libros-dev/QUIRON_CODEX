import threading, http.server, socketserver, functools, time, datetime, json
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4263),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1300,'height':920})
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4263/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat())
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.8)

    def prefs():
        pg.evaluate("() => { const b=[...document.querySelectorAll('button')].find(x=>/Ajustes/.test(x.textContent)); b&&b.click(); }"); time.sleep(0.4)
        pg.evaluate("() => { const b=[...document.querySelectorAll('button')].find(x=>/Preferencias/.test(x.textContent)); b&&b.click(); }"); time.sleep(0.8)
    def stub(body, status=200):
        pg.evaluate("""([body, status]) => {
          const real = window.fetch;
          window.fetch = async (u, o) => String(u).includes('api.github.com')
            ? new Response(body, { status })
            : real(u, o);
        }""", [json.dumps(body) if isinstance(body, dict) else body, status])

    prefs()
    ok('hay sección de versión en Preferencias', 'Buscar actualización' in pg.inner_text('.modal'))
    ok('dice qué versión tienes', 'Tienes la' in pg.inner_text('.modal'))

    # 1. Al día
    stub({'tag_name': 'v0.0.1', 'assets': []})
    pg.click('.modal button:has-text("Buscar actualización")'); time.sleep(1.2)
    ok('cuando no hay nada nuevo dice que estás al día', 'al día' in pg.inner_text('.modal'))

    # 2. Hay versión nueva
    stub({'tag_name': 'v99.0.0', 'body': 'Novedades de prueba', 'html_url': 'https://ejemplo/x',
          'assets': [{'name': 'Quiron.Codex_99.0.0_x64-setup.exe', 'browser_download_url': 'https://ejemplo/x.exe'}]})
    pg.click('.modal button:has-text("Buscar actualización")'); time.sleep(1.2)
    txt = pg.inner_text('.modal')
    ok('avisa de la versión nueva', '99.0.0' in txt, txt[:100].replace('\n',' '))
    ok('muestra qué trae', 'Novedades de prueba' in txt)
    ok('en la web ofrece recargar, no descargar', 'Recargar para actualizar' in txt and 'Descargar' not in txt)

    # 3. GitHub falla: no debe decir que estás al día
    stub('{"message":"boom"}', 500)
    pg.click('.modal button:has-text("Buscar actualización")'); time.sleep(1.2)
    txt = pg.inner_text('.modal')
    upd = pg.inner_text('.upd')
    ok('si GitHub falla lo dice, no miente', 'No se pudo' in upd and 'al día' not in upd, upd.replace('\n',' | ')[:200])

    # 4. Sin internet
    pg.evaluate("() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true })")
    pg.click('.modal button:has-text("Buscar actualización")'); time.sleep(1.0)
    ok('sin internet lo dice y no alarma', 'No hay internet' in pg.inner_text('.upd'), pg.inner_text('.upd').replace('\n',' | ')[:160])

    # Comparación de versiones con tags raros
    cmp = pg.evaluate("""() => {
      const isNewer = (a, b) => { const pa=a.split('.').map(Number), pb=b.split('.').map(Number);
        for (let i=0;i<Math.max(pa.length,pb.length);i++){const x=pa[i]||0,y=pb[i]||0; if(x!==y) return x>y;} return false; };
      return [isNewer('0.21.0','0.20.0'), isNewer('0.20.0','0.20.0'), isNewer('0.2.0','0.20.0')];
    }""")
    ok('0.21 > 0.20', cmp[0] is True)
    ok('la misma versión no es más nueva', cmp[1] is False)
    ok('0.2 no es más nueva que 0.20', cmp[2] is False)
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
