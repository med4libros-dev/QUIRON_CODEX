import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4267),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1340,'height':940}, accept_downloads=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4267/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat())
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(1.0)

    # Dejar rastro: una lección marcada y una perla
    pg.click('.lesson-check >> nth=0'); time.sleep(0.8)
    marcadas = lambda: len(pg.evaluate("() => JSON.parse(localStorage.getItem('alq:internship') || '{}').done || {}"))
    ok('se marcó una lección', marcadas() >= 1, marcadas())
    pg.click('.rail-btn:has-text("Perlas HY")'); pg.wait_for_selector('.hy-page'); time.sleep(0.4)
    pg.click('.hy-add'); pg.select_option('.hy-editor select[aria-label="Tipo"]', 'triada')
    pg.fill('.hy-editor input[aria-label="Nombre"]', 'Tríada de Beck')
    pg.fill('.hy-editor textarea[aria-label="Perla"]', 'Hipotensión, yugulares, ruidos velados')
    pg.click('.hy-editor button:has-text("Guardar")'); time.sleep(0.8)

    def abrir():
        pg.click('.rail-btn:has-text("Herramientas")'); time.sleep(0.4)
        pg.click('.rail-pop button:has-text("Empezar de cero")'); pg.wait_for_selector('.modal'); time.sleep(0.5)
    abrir()
    txt = pg.inner_text('.modal')
    ok('se puede abrir desde Herramientas', 'Empezar de cero' in txt)
    ok('deja elegir qué se borra', pg.locator('.reset-list input[type=checkbox]').count() >= 6, pg.locator('.reset-list input').count())
    ok('dice qué NO se toca', 'no se tocan' in txt and 'cuadernos' in txt)
    ok('viene marcado solo el progreso', pg.evaluate("() => [...document.querySelectorAll('.reset-list input')].filter(i => i.checked).length") == 1)
    ok('ofrece respaldo antes de borrar', pg.is_checked('.reset-bk input'))
    ok('avisa que no se puede deshacer', 'no se puede deshacer' in txt)
    ok('no deja borrar sin escribir la palabra', pg.is_disabled('.modal button:has-text("Reiniciar")'))

    pg.fill('.reset-confirm input', 'reiniciar'); time.sleep(0.4)
    ok('acepta la palabra en minúsculas', not pg.is_disabled('.modal button:has-text("Reiniciar")'))
    pg.fill('.reset-confirm input', 'otra cosa'); time.sleep(0.3)
    ok('y rechaza cualquier otra', pg.is_disabled('.modal button:has-text("Reiniciar")'))

    # Reiniciar solo el progreso: se va lo marcado, se queda el plan y la perla
    pg.fill('.reset-confirm input', 'REINICIAR'); time.sleep(0.3)
    with pg.expect_download(timeout=25000) as dl:
        pg.click('.modal button:has-text("Reiniciar")')
    ok('descarga el respaldo antes de borrar', dl.value.suggested_filename.endswith('.json'))
    # Tras recargar, la app abre en la vista donde estabas; volvemos a Inicio.
    time.sleep(2.5)
    pg.click('.rail-btn:has-text("Inicio")'); pg.wait_for_selector('.day-card, .setup', timeout=25000); time.sleep(1.0)
    ok('se borró el progreso', marcadas() == 0, marcadas())
    ok('el plan sigue en pie', pg.evaluate("() => !!JSON.parse(localStorage.getItem('alq:internship') || '{}').config"))
    pg.click('.rail-btn:has-text("Perlas HY")'); pg.wait_for_selector('.hy-page'); time.sleep(0.6)
    ok('las perlas no se tocaron', 'Tríada de Beck' in pg.inner_text('.hy-page'))

    # Reiniciar el plan completo: vuelve el asistente
    abrir()
    pg.uncheck('.reset-list input >> nth=0'); pg.check('.reset-list input >> nth=1')
    pg.uncheck('.reset-bk input'); pg.fill('.reset-confirm input', 'REINICIAR'); time.sleep(0.3)
    pg.click('.modal button:has-text("Reiniciar")')
    time.sleep(2.5)
    pg.click('.rail-btn:has-text("Inicio")'); pg.wait_for_selector('.setup', timeout=25000); time.sleep(1.0)
    ok('borrar el plan devuelve el asistente', pg.locator('.setup').count() == 1)
    ok('y el plan ya no está', pg.evaluate("() => !JSON.parse(localStorage.getItem('alq:internship') || '{}').config"))
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()).isoformat())
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.8)
    pg.click('.rail-btn:has-text("Perlas HY")'); pg.wait_for_selector('.hy-page'); time.sleep(0.6)
    ok('las perlas siguen ahí tras borrar el plan', 'Tríada de Beck' in pg.inner_text('.hy-page'))
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
