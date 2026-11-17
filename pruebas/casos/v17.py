import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4256),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
CERRADO={'width':344,'height':882}; ABIERTO={'width':690,'height':829}
def chicos(pg):
    return pg.evaluate("""() => [...document.querySelectorAll('button, a[href], select, input, [role=slider]')]
      .filter(e => e.offsetParent && e.getBoundingClientRect().height > 0)
      .map(e => { const r = e.getBoundingClientRect();
        return { t: (e.textContent||e.getAttribute('aria-label')||e.tagName).trim().slice(0,16), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(x => x.h < 44 || x.w < 24)""")
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport=CERRADO, device_scale_factor=2.625, is_mobile=True, has_touch=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4256/'); time.sleep(1.5)

    ok('el teléfono abre en Bolsillo, no en el asistente', pg.locator('.pocket').count() == 1 and pg.locator('.setup').count() == 0)
    ok('arranca en Guardia', pg.inner_text('.pk-title') == 'Guardia')
    ok('están las pestañas de Bolsillo', pg.locator('.pk-tab').count() == 5, pg.inner_text('.pk-tabs').replace('\n','/'))
    ok('nada se desborda a 344 px', pg.evaluate("() => document.documentElement.scrollWidth") == 344)
    ok('ningún control por debajo de 44 px', len(chicos(pg)) == 0, chicos(pg)[:3])
    ok('dice dónde se llenan las fichas', 'tableta' in pg.inner_text('.pk-empty'))

    for t, titulo in [('Dosis','Dosis'), ('Escalas','Escalas'), ('Repaso','Repaso')]:
        pg.click(f'.pk-tab:has-text("{t}")'); time.sleep(1.2)
        ok(f'{t}: cambia de pestaña', pg.inner_text('.pk-title') == titulo)
        ok(f'{t}: no se desborda', pg.evaluate("() => document.documentElement.scrollWidth") == 344)
        ok(f'{t}: sin controles chicos', len(chicos(pg)) == 0, chicos(pg)[:2])

    pg.click('.pk-tab:has-text("Escalas")'); time.sleep(0.8)
    ok('están las 17 escalas', pg.locator('.calc').count() >= 17, pg.locator('.calc').count())
    pg.fill('.pk-search', 'glasgow'); time.sleep(0.5)
    ok('se pueden buscar', pg.locator('.calc').count() == 1, pg.locator('.calc').count())
    pg.click('.calc-head'); time.sleep(0.5)
    ok('la escala abre y calcula', pg.locator('.calc.open .calc-body').count() == 1)
    pg.select_option('.calc-body select >> nth=0', '3'); pg.select_option('.calc-body select >> nth=1', '4')
    pg.select_option('.calc-body select >> nth=2', '5'); time.sleep(0.5)
    res = pg.inner_text('.calc-body')
    ok('da un resultado con los tres campos', '15' in res, res[-90:].replace('\n',' '))

    # Desplegar el Fold: la app completa, en vivo, sin recargar
    pg.set_viewport_size(ABIERTO); time.sleep(1.2)
    ok('al desplegar sale de Bolsillo', pg.locator('.pocket').count() == 0 and pg.locator('.app').count() == 1)
    if pg.locator('.setup').count():
        pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat())
        pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(1.0)
    ok('desplegado tampoco se desborda', pg.evaluate("() => document.documentElement.scrollWidth") == 690)
    ok('desplegado, todo mide 44 px o más', len(chicos(pg)) == 0, chicos(pg)[:3])
    pg.set_viewport_size(CERRADO); time.sleep(1.2)
    ok('al cerrar vuelve a Bolsillo', pg.locator('.pocket').count() == 1)

    # «Ver todo» se recuerda
    pg.click('.pk-exit'); time.sleep(1.2)
    ok('«Ver todo» abre la app completa en el teléfono', pg.locator('.pocket').count() == 0)
    pg.reload(); time.sleep(2.0)
    ok('y se recuerda al volver a abrir', pg.locator('.pocket').count() == 0)

    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
