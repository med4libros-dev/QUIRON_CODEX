import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4261),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
IPAD={'width':834,'height':1194}   # iPad Pro 11" en vertical
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport=IPAD, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4261/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat())
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.8)
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(2.0)

    alto = pg.evaluate("() => { const r = document.querySelector('.app').getBoundingClientRect(); return [Math.round(r.height), window.innerHeight]; }")
    ok('la app mide lo que se ve, no más', alto[0] == alto[1], alto)
    ok('en vertical se parte arriba/abajo', pg.locator('.split.vertical').count() == 1)
    ok('hay asas para colapsar', pg.locator('.split-grip').count() == 2)

    def alto_de(sel):
        return pg.evaluate(f"() => {{ const e = document.querySelector('{sel}'); return e ? Math.round(e.getBoundingClientRect().height) : 0; }}")
    notas_antes = alto_de('[aria-label="Notas"]')
    ok('las notas se ven antes de colapsar', notas_antes > 100, notas_antes)

    pg.click('.split-grip >> nth=0'); time.sleep(0.8)
    notas = alto_de('[aria-label="Notas"]')
    ok('al colapsar el PDF, las notas ocupan casi todo', notas > alto[1] * 0.75, f'{notas} de {alto[1]}')
    ok('el PDF queda oculto', pg.locator('[aria-label="Lector PDF"]').count() == 0 or pg.evaluate("() => document.querySelector('[aria-label=\\\"Lector PDF\\\"]').hidden") is True)
    ok('aparece la pestaña para volver', pg.locator('.split-back').count() == 1)
    ok('la pestaña es tocable', pg.evaluate("() => Math.round(document.querySelector('.split-back').getBoundingClientRect().height)") >= 44)

    pg.click('.split-back'); time.sleep(0.8)
    ok('se vuelve a ver los dos', pg.locator('.split-grip').count() == 2 and alto_de('[aria-label="Lector PDF"]') > 100)

    pg.click('.split-grip >> nth=1'); time.sleep(0.8)
    ok('la otra asa colapsa las notas', pg.evaluate("() => document.querySelector('[aria-label=\\\"Notas\\\"]').hidden") is True)
    pg.click('.split-back'); time.sleep(0.6)

    # Apaisado: las asas se ponen de lado
    pg.set_viewport_size({'width': 1194, 'height': 834}); time.sleep(1.0)
    ok('apaisado parte izquierda/derecha', pg.locator('.split.vertical').count() == 0)
    ok('las asas siguen ahí', pg.locator('.split-grip').count() == 2)
    pg.click('.split-grip >> nth=0'); time.sleep(0.8)
    ancho = pg.evaluate("() => Math.round(document.querySelector('[aria-label=\\\"Notas\\\"]').getBoundingClientRect().width)")
    ok('colapsar también funciona apaisado', ancho > 1194 * 0.8, ancho)
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
