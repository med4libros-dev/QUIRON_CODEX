"""Las opciones de un <select> deben ser legibles aunque Windows esté en modo claro
y la app en oscuro: el menú lo dibuja el sistema y no hereda el tema de la página."""
import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4281),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)

def lum(c):
    def f(v):
        v/=255
        return v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])

def razon(a,b):
    la,lb=lum(a),lum(b)
    hi,lo=max(la,lb),min(la,lb)
    return (hi+0.05)/(lo+0.05)

def rgb(s):
    n=[int(x) for x in s[s.index('(')+1:s.index(')')].split(',')[:3]]
    return n

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1340,'height':940})
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4281/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()+datetime.timedelta(days=5)).isoformat())
    time.sleep(0.5)
    ok('el asistente trae selectores de rotación', pg.locator('.rot-list select').count() >= 2, pg.locator('.rot-list select').count())

    for look in ('vidrio','codice'):
        for theme in ('light','dark'):
            pg.evaluate("([l,t]) => { document.documentElement.dataset.look = l; document.documentElement.dataset.theme = t; }", [look, theme])
            time.sleep(0.35)
            vals = pg.evaluate("""() => {
              const o = document.querySelector('.rot-list select option');
              const s = getComputedStyle(o);
              return [s.color, s.backgroundColor];
            }""")
            # Un fondo transparente significa que el sistema pone el suyo: justo el fallo.
            propio = 'rgba(0, 0, 0, 0)' not in vals[1]
            ok(f'{look}/{theme}: la opción fija su fondo', propio, vals[1])
            # El cociente solo significa algo si hay un fondo real contra el cual medir.
            r = razon(rgb(vals[0]), rgb(vals[1])) if propio else None
            ok(f'{look}/{theme}: opción legible (≥4.5:1)', r is not None and r >= 4.5,
               round(r,2) if r is not None else 'sin fondo propio')

    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
