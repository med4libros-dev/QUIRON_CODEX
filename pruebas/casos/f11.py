import threading, http.server, socketserver, functools, time, sys
from playwright.sync_api import sync_playwright

import math as _math

def dial_open(page, which='.pen-dial'):
    """Abre el disco de instrumentos si está cerrado."""
    page.wait_for_selector(which)
    if page.locator(which + '.closed').count():
        page.click(which + ' .dial-knob')
    page.wait_for_selector(which + ' .dial-svg', state='visible')

def dial_close(page, which='.pen-dial'):
    """Cierra el disco por su centro (Escape también devuelve el PDF a «seleccionar»)."""
    if page.locator(which + '.open').count():
        page.click(which + ' .dial-center')

def dial_pick(page, ring, index, total, which='.pen-dial'):
    """Gira un anillo del disco hasta el sector `index` de `total` (tocándolo en su centro)."""
    dial_open(page, which)
    bx = page.locator(which + ' .dial-svg').bounding_box()
    k = bx['width'] / 216
    cx, cy = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
    r = {'tool': 44, 'color': 69, 'size': 94}[ring]
    a = -_math.pi / 2 + (index / total) * _math.pi * 2
    page.mouse.click(cx + r * k * _math.cos(a), cy + r * k * _math.sin(a))

http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k:None
class Q(socketserver.TCPServer): allow_reuse_address=True
URL = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4182/'
if URL.startswith('http'):
    srv=Q(('127.0.0.1',4182), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever,daemon=True).start()
res, errs = {}, []
def ok(n,c,x=''):
    res[n]=bool(c); print(('PASS ' if c else 'FAIL ')+n, str(x)[:170]); sys.stdout.flush()
INK="""()=>new Promise(r=>{const q=indexedDB.open('alquimia');q.onsuccess=()=>{const g=q.result.transaction('ink').objectStore('ink').getAll();g.onsuccess=()=>r(g.result.flat().filter(s=>s&&s.points))}})"""
# Traza una polilínea con el lápiz sobre un elemento (coords relativas al elemento, en px CSS)
PATH="""([sel,pts,pid,hold])=>{const el=document.querySelector(sel);const r=el.getBoundingClientRect();
 const mk=(t,x,y,b)=>new PointerEvent(t,{pointerId:pid,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,clientX:r.left+x,clientY:r.top+y,pressure:b?0.6:0,buttons:b?1:0});
 el.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1],1));
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const n=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/6));
  for(let k=1;k<=n;k++)el.dispatchEvent(mk('pointermove',a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,1));}
 if(!hold)el.dispatchEvent(mk('pointerup',pts[pts.length-1][0],pts[pts.length-1][1],0));
 return true;}"""
UP="""([sel,x,y,pid])=>{const el=document.querySelector(sel);const r=el.getBoundingClientRect();
 el.dispatchEvent(new PointerEvent('pointerup',{pointerId:pid,pointerType:'pen',isPrimary:true,bubbles:true,clientX:r.left+x,clientY:r.top+y,pressure:0,buttons:0}));}"""

with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1368,'height':912})
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_selector('.rail')
    pg.click('.rail-btn:has-text("Cuadernos")'); time.sleep(0.5)
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.4)
    pg.click('.notes-panel button:has-text("Nueva nota")'); time.sleep(0.4)
    pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(0.5)

    # ---------- plumas favoritas ----------
    dial_open(pg)
    ok('four favorite pens', pg.locator('.dial-fav').count()==4, pg.locator('.dial-fav').count())
    pg.click('.dial-fav >> nth=1'); time.sleep(0.3)
    tools=pg.evaluate("()=>JSON.parse(localStorage.getItem('alq:tools'))")
    ok('favorite applies color and tool', tools['canvasTool']=='pen' and tools['settings']['pen']['color']=='#dc2626', tools['settings']['pen'])
    ok('favorite marked active', 'active' in (pg.get_attribute('.dial-fav >> nth=1','class') or ''))
    dial_close(pg); time.sleep(0.3)

    # ---------- trazos y lazo ----------
    pg.evaluate(PATH, ['.ink-page', [[60,80],[150,110],[240,80]], 11, False]); time.sleep(0.4)
    pg.evaluate(PATH, ['.ink-page', [[60,240],[150,270],[240,240]], 12, False]); time.sleep(1.4)
    st=pg.evaluate(INK); ok('two strokes drawn', len(st)==2, len(st))
    pg.click('button[aria-label="Lazo"]'); time.sleep(0.2)
    pg.evaluate(PATH, ['.ink-page', [[30,50],[270,50],[270,150],[30,150],[30,50]], 13, False]); time.sleep(0.5)
    ok('lasso shows a selection box', pg.locator('.sel-box').count()==1)
    ok('selection bar with actions', pg.locator('.sel-bar .icon-btn').count()==5 and pg.locator('.sel-bar .swatch').count()==5, (pg.locator('.sel-bar .icon-btn').count(), pg.locator('.sel-bar .swatch').count()))  # +leer la selección
    y0=min(p[1] for p in st[0]['points'])
    # mover la selección hacia abajo
    pg.evaluate(PATH, ['.ink-page', [[150,100],[150,170]], 14, False]); time.sleep(0.8)
    st2=pg.evaluate(INK)
    moved=[s for s in st2 if s['id']==st[0]['id']][0]
    dy=min(p[1] for p in moved['points'])-y0
    ok('lasso moves the selected stroke', dy>60 and len(st2)==2, dy)
    other=[s for s in st2 if s['id']==st[1]['id']][0]
    ok('the stroke outside the lasso does not move', other['points']==st[1]['points'])
    pg.click('.sel-bar .swatch >> nth=1'); time.sleep(0.8)
    st3=pg.evaluate(INK)
    ok('selection changes color', [s for s in st3 if s['id']==st[0]['id']][0]['color']=='#dc2626')
    pg.click('.sel-bar .icon-btn[title="Duplicar"]'); time.sleep(0.8)
    ok('selection duplicates', len(pg.evaluate(INK))==3)
    pg.click('.sel-bar .icon-btn[title^="Borrar"]'); time.sleep(0.8)
    ok('selection deletes', len(pg.evaluate(INK))==2 and pg.locator('.sel-box').count()==0)

    # ---------- formas rectas ----------
    pg.click('button[aria-label="Lazo"]'); time.sleep(0.2)
    pg.evaluate(PATH, ['.ink-page', [[320,420],[520,424],[520,560],[322,556],[320,424]], 15, True])
    time.sleep(1.0)  # el lápiz se queda quieto: debe reconocerse la forma
    pg.evaluate(UP, ['.ink-page', 320, 424, 15]); time.sleep(1.4)
    st4=pg.evaluate(INK); rect=[s for s in st4 if s['id'] not in [x['id'] for x in st3]]
    xs=[p[0] for p in rect[0]['points']] if rect else []
    ys=[p[1] for p in rect[0]['points']] if rect else []
    corners=len({(round(x/30),round(y/30)) for x,y in zip(xs,ys)}) if rect else 0
    straight = bool(rect) and all(abs(p[0]-min(xs))<2 or abs(p[0]-max(xs))<2 or abs(p[1]-min(ys))<2 or abs(p[1]-max(ys))<2 for p in rect[0]['points'])
    ok('a rough square becomes a clean rectangle', straight, (len(rect), corners))
    pg.evaluate(PATH, ['.ink-page', [[320,650],[420,662],[520,676]], 16, True]); time.sleep(1.0)
    pg.evaluate(UP, ['.ink-page', 520, 676, 16]); time.sleep(1.4)
    st5=pg.evaluate(INK); line=[s for s in st5 if s['id'] not in [x['id'] for x in st4]]
    pts=line[0]['points'] if line else []
    dev=max(abs((p[1]-pts[0][1])-(p[0]-pts[0][0])*(pts[-1][1]-pts[0][1])/max(1,(pts[-1][0]-pts[0][0]))) for p in pts) if pts else 99
    ok('a wobbly line becomes straight', dev<1.5, dev)
    # se puede desactivar
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Preferencias")'); pg.wait_for_selector('.prefs')
    ok('shapes and barrel button in Preferencias', pg.locator('.prefs select[aria-label="Botón lateral del lápiz"]').count()==1 and pg.locator('.prefs label:has-text("Formas rectas")').count()==1)
    ok('pen diagnostic available', pg.locator('.prefs button:has-text("Diagnóstico del lápiz")').count()==1)
    pg.click('.prefs button:has-text("Diagnóstico del lápiz")'); pg.wait_for_selector('.diag-canvas')
    pg.evaluate(PATH, ['.diag-canvas', [[40,40],[200,90],[320,60]], 17, False]); time.sleep(0.6)
    out=pg.inner_text('.diag-out') if pg.locator('.diag-out').count() else ''
    ok('the diagnostic measures and reports', 'Evento → pintado' in out and 'Cuadro' in out, out.replace('\n',' | ')[:150])
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); time.sleep(0.3)

    # ---------- hojas ----------
    pg.wait_for_selector('.ink-sheet')
    n=pg.locator('.ink-sheet').count()
    pg.click('button[aria-label="Insertar hoja antes de la 1"]'); time.sleep(0.8)
    ok('insert a sheet before the first one', pg.locator('.ink-sheet').count()==n+1 and all(s['page']>=1 for s in pg.evaluate(INK)))
    pg.click('button[aria-label="Subir hoja 2"]'); time.sleep(0.8)
    ok('move a sheet up', all(s['page']==0 for s in pg.evaluate(INK)))
    pg.click('button[aria-label="Quitar hoja 2"]'); time.sleep(0.8)
    ok('remove an empty sheet', pg.locator('.ink-sheet').count()==n and len(pg.evaluate(INK))>0)
    pg.select_option('.ink-toolbar select[aria-label="Tipo de hoja"]','cornell'); time.sleep(0.4)
    ok('Cornell template', pg.get_attribute('.ink-page','data-paper')=='cornell')
    pg.select_option('.ink-toolbar select[aria-label="Tipo de hoja"]','columns'); time.sleep(0.3)
    ok('two-column template', pg.get_attribute('.ink-page','data-paper')=='columns')

    # ---------- PDF oscuro y pantalla completa ----------
    pg.set_input_files('.pdf-body input[type=file]',['/tmp/tc/043GER_Neumonia.pdf'])
    pg.wait_for_function("[...document.querySelectorAll('.pdf-page > canvas')].some(c=>c.width>0)",timeout=15000); time.sleep(0.8)
    pg.click('.pdf-workspace [data-more-toggle]'); pg.click('.more-menu button:has-text("Guía en oscuro")'); time.sleep(0.4)
    ok('dark guide', pg.get_attribute('.pdf-scroll','data-dark')=='1' and 'invert' in pg.evaluate("getComputedStyle(document.querySelector('.pdf-page > canvas')).filter"))
    pg.click('.pdf-workspace [data-more-toggle]'); pg.click('.more-menu button:has-text("Guía en claro")'); time.sleep(0.3)
    ok('back to light', pg.get_attribute('.pdf-scroll','data-dark') is None)
    pg.click('.pdf-workspace [data-more-toggle]'); pg.click('.more-menu button:has-text("Pantalla completa")'); time.sleep(0.5)
    ok('focus mode hides the rail and the top bar', pg.evaluate("document.documentElement.dataset.focus")=='on' and not pg.locator('.rail').is_visible() and pg.locator('.focus-exit').count()==1)
    # La rejilla debe quedar de una sola columna: con «0 1fr» el PDF se quedaba sin ancho.
    w = pg.evaluate("() => { const s=document.querySelector('.pdf-scroll'), m=document.querySelector('.main'); return [Math.round(s.getBoundingClientRect().width), Math.round(m.getBoundingClientRect().width)]; }")
    ok('focus mode keeps the PDF at full width', w[0] > 300 and w[1] > 900, w)
    ok('notes stay visible in focus mode', pg.locator('.notes-panel').is_visible())
    pg.keyboard.press('Escape'); time.sleep(0.4)
    ok('Esc exits focus mode', pg.evaluate("document.documentElement.dataset.focus") is None and pg.locator('.rail').is_visible())

    real=[e for e in errs if 'favicon' not in e and 'fullscreen' not in e.lower() and 'Permissions' not in e]
    print('errors', real[:4]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
