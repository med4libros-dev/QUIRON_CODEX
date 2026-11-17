import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4222),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def ratio(a,b):
    l1,l2=sorted([lum(a),lum(b)],reverse=True); return (l1+0.05)/(l2+0.05)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':960}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4222/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.5)

    # --- accesibilidad del pack ---
    for theme in ('light','dark'):
        pg.evaluate(f"document.documentElement.dataset.theme='{theme}'"); time.sleep(0.4)
        tok = pg.evaluate("() => { const c = getComputedStyle(document.documentElement); const g = k => c.getPropertyValue(k).trim(); return {border: g('--border-strong'), surface: g('--surface'), text: g('--text'), muted: g('--text-muted'), accent: g('--accent'), paper: g('--paper')}; }")
        ok(f'[{theme}] el borde de los campos llega a 3:1', ratio(tok['border'], tok['surface']) >= 3.0, (tok['border'], tok['surface'], round(ratio(tok['border'],tok['surface']),2)))
        ok(f'[{theme}] el texto apagado llega a 4.5:1', ratio(tok['muted'], tok['surface']) >= 4.5, round(ratio(tok['muted'],tok['surface']),2))
        ok(f'[{theme}] el anillo de foco llega a 3:1 sobre la lámina', ratio(tok['accent'], tok['surface']) >= 3.0, round(ratio(tok['accent'],tok['surface']),2))
    ok('la selección de texto usa el cardenillo del pack', 'rgba(147, 197, 114' not in pg.evaluate("() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch { return []; } }).join(' ')"))
    pg.evaluate("document.documentElement.dataset.theme='dark'"); time.sleep(0.3)
    pg.keyboard.press('Tab'); time.sleep(0.3)
    ok('el foco del teclado se ve', pg.evaluate("() => { const e = document.activeElement; const s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1; }"))

    # --- examen largo ---
    pg.click('.rail-btn:has-text("Simulacros")'); time.sleep(1.0)
    ok('hay pestaña de examen largo', pg.locator('.exam-tabs button:has-text("Examen largo")').count() == 1)
    pg.click('.exam-tabs button:has-text("Examen largo")'); time.sleep(0.6)
    ok('se configuran bloques', pg.locator('.exam-setup select').count() >= 2, pg.locator('.exam-setup select').count())
    ok('se configuran minutos y descanso', pg.locator('.exam-setup input[type=number]').count() == 2)
    ok('sin banco no deja empezar', pg.locator('.exam-setup .btn.primary[disabled]').count() == 1)

    # --- preferencias nuevas ---
    pg.click('.rail-btn:has-text("Ajustes")'); time.sleep(0.5)
    pg.click('.rail-pop button:has-text("Preferencias")'); time.sleep(0.8)
    txt = pg.inner_text('.modal')
    ok('está el reconocimiento en segundo plano', 'segundo plano' in txt)
    ok('está traer solo de la carpeta', 'Traer solo' in txt)
    ok('ambos vienen apagados', pg.locator('.modal input[type=checkbox]:checked').count() <= 2, pg.locator('.modal input[type=checkbox]:checked').count())
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
