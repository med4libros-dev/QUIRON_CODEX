import re
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
def rgb(c, fondo=(255, 255, 255)):
    """Acepta #hex y rgb()/rgba(); lo translúcido se compone sobre el fondo que se le pase."""
    c = c.strip()
    if c.startswith('#'):
        h = c[1:]
        if len(h) == 3: h = ''.join(x * 2 for x in h)
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
    n = [float(x) for x in re.findall(r'[\d.]+', c)]
    if len(n) >= 4 and n[3] < 1:
        return tuple(n[i] * n[3] + fondo[i] * (1 - n[3]) for i in range(3))
    return tuple(n[:3])

def lum(h, fondo=(255, 255, 255)):
    r,g,b=[v/255 for v in rgb(h, fondo)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def ratio(a,b):
    base = rgb(b) if not b.strip().startswith('rgba') else (255, 255, 255)
    l1,l2=sorted([lum(a, base),lum(b)],reverse=True); return (l1+0.05)/(l2+0.05)
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
        # Con el pack de vidrio las superficies son translúcidas: hay que componerlas sobre
        # lo que tienen detrás, no sobre blanco. Se calcula en la página, con los colores reales.
        razones = pg.evaluate("""() => {
          const px = (c) => { c = c.trim();
            if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = [...h].map(x => x + x).join('');
              return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1); }
            const n = (c.match(/[\\d.]+/g) || []).map(Number); return n.length > 3 ? n : [...n.slice(0,3), 1]; };
          const sobre = (f, b) => f.slice(0,3).map((v, i) => v * f[3] + b[i] * (1 - f[3]));
          const L = (c) => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055) ** 2.4; });
            return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
          const r = (a, b) => { const [x, y] = [L(a) + 0.05, L(b) + 0.05].sort((p, q) => q - p); return Math.round(x / y * 100) / 100; };
          const cs = getComputedStyle(document.documentElement);
          const v = (k) => px(cs.getPropertyValue(k));
          const base = px(getComputedStyle(document.body).backgroundColor);
          const sup = sobre(v('--surface'), base);
          return { borde: r(sobre(v('--border-strong'), sup), sup), apagado: r(sobre(v('--text-muted'), sup), sup) };
        }""")
        ok(f'[{theme}] el borde de los campos llega a 3:1', razones['borde'] >= 3.0, razones)
        ok(f'[{theme}] el texto apagado llega a 4.5:1', razones['apagado'] >= 4.5, razones)
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
