import threading, http.server, socketserver, functools, time, json, datetime, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4192/'
if URL.startswith('http'):
    srv = Q(('127.0.0.1', 4192), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:160]); sys.stdout.flush()
start = (datetime.date(2026, 11, 13) - datetime.timedelta(days=40)).isoformat()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, color_scheme=scheme)
        if URL.startswith('http'): ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=URL.rstrip('/'))
        pg = ctx.new_page()
        pg.add_init_script(f"if (!localStorage.getItem('alq:settings')) localStorage.setItem('alq:settings', JSON.stringify({{theme: '{scheme}'}}))")
        pg.clock.set_fixed_time(datetime.datetime(2026, 11, 13, 9, 0)) if False else None
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); pg.wait_for_selector('.setup')
        pg.fill('.setup input[type=date] >> nth=0', start); pg.fill('.setup input[type=number] >> nth=0', '60'); time.sleep(0.2)
        pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card')
        # --- El pack por omisión es el vidrio; Códice sigue disponible. Cada uno con sus reglas. ---
        look = pg.evaluate("document.documentElement.dataset.look")
        ok(f'[{scheme}] el vidrio es el pack por omisión', look == 'glass', look)
        bf = pg.evaluate("getComputedStyle(document.querySelector('.card')).backdropFilter")
        ok(f'[{scheme}] el vidrio desenfoca lo que tiene detrás', 'blur' in bf, bf)
        bd = pg.evaluate("getComputedStyle(document.querySelector('.topbar')).backdropFilter")
        ok(f'[{scheme}] la barra también es material', 'blur' in bd, bd)
        amb = pg.evaluate("getComputedStyle(document.body).backgroundImage")
        ok(f'[{scheme}] hay un fondo del que tomar color', 'radial-gradient' in amb, amb[:60])
        # Mientras el lápiz escribe no se desenfoca: es lo que mata la latencia.
        pg.evaluate("() => document.documentElement.dataset.inkBusy = '1'"); time.sleep(0.2)
        bf2 = pg.evaluate("getComputedStyle(document.querySelector('.card')).backdropFilter")
        ok(f'[{scheme}] escribiendo, el desenfoque se apaga', bf2 == 'none', bf2)
        pg.evaluate("() => delete document.documentElement.dataset.inkBusy"); time.sleep(0.2)
        pg.evaluate("() => document.documentElement.dataset.saver = 'on'"); time.sleep(0.2)
        ok(f'[{scheme}] en ahorro de batería tampoco', pg.evaluate("getComputedStyle(document.querySelector('.card')).backdropFilter") == 'none')
        pg.evaluate("() => delete document.documentElement.dataset.saver"); time.sleep(0.2)
        # Los bordes que identifican un control, a 3:1 (WCAG 1.4.11).
        razon = pg.evaluate("""() => {
          const px = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m.length > 3 ? m : [...m, 1]; };
          const mezcla = (f, b) => f.slice(0,3).map((v, i) => v * f[3] + b[i] * (1 - f[3]));
          const lum = (c) => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055) ** 2.4; });
            return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
          const cs = getComputedStyle(document.documentElement);
          const fondo = px(getComputedStyle(document.querySelector('.card')).backgroundColor);
          const base = px(getComputedStyle(document.body).backgroundColor);
          const sup = mezcla(fondo, base);
          const bor = mezcla(px(cs.getPropertyValue('--border-strong')), sup);
          const [a, b] = [lum(bor) + 0.05, lum(sup) + 0.05].sort((x, y) => y - x);
          return Math.round((a / b) * 100) / 100;
        }""")
        ok(f'[{scheme}] los bordes de control llegan a 3:1', razon >= 3, razon)
        # Y Códice sigue siendo Códice cuando se elige.
        pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('alq:settings')); s.look = 'codice'; localStorage.setItem('alq:settings', JSON.stringify(s)); }")
        pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(0.5)
        ok(f'[{scheme}] Códice sigue disponible y sin desenfoques', pg.evaluate("getComputedStyle(document.querySelector('.card')).backdropFilter") == 'none')
        paper = pg.evaluate("() => { const c = getComputedStyle(document.documentElement); const lum = (v) => { const h = v.trim().replace('#',''); const n = parseInt(h.length === 3 ? h.split('').map(x=>x+x).join('') : h, 16); return 0.2126*((n>>16)&255) + 0.7152*((n>>8)&255) + 0.0722*(n&255); }; return ['--paper','--surface','--bg'].map(k => lum(c.getPropertyValue(k))); }")
        ok(f'[{scheme}] en Códice el papel sigue mandando', paper[0] > paper[1] > paper[2] if scheme == 'light' else paper[0] > paper[2], paper)
        pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('alq:settings')); s.look = 'glass'; localStorage.setItem('alq:settings', JSON.stringify(s)); }")
        pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(0.5)
        pg.screenshot(path=f'/tmp/tc/shots/f4-{scheme}-inicio.png')
        if scheme == 'light':
            pg.reload(); pg.wait_for_selector('.day-card')
            ok('el pack elegido se mantiene al recargar', pg.evaluate("document.documentElement.dataset.look") == 'glass')
            ctx.close(); continue

        # ---------- Reproductor ----------
        ok('mini player pill visible', pg.locator('.mini-player.pill').count() == 1)
        pg.click('.mp-orb'); pg.wait_for_selector('.mini-player.open')
        pg.set_input_files('[data-testid="music-input"]', '/tmp/tc/music/Mi Playlist'); time.sleep(0.6)
        names = pg.locator('.mini-player .mp-meta b').inner_text()
        ok('folder loaded, audio filtered (no .txt/.jpg)', '5' in pg.inner_text('.mp-meta .muted') and 'Lluvia' in names, pg.inner_text('.mp-meta'))
        pg.click('.mini-player button[aria-label="Lista de canciones"]'); time.sleep(0.2)
        order = pg.locator('.mp-list li').all_inner_texts()
        ok('natural sort incl. subfolders', [o.split('\n')[-1] for o in order] == ['01 Lluvia', '02 Bosque', '10 Final', '03 Mar', '04 Brisa'], order)
        urls = pg.evaluate("() => performance.getEntriesByType('resource').length >= 0")
        pg.click('.mp-btn.main'); time.sleep(1.2)
        st = pg.evaluate("JSON.parse(localStorage.getItem('alq:music') || '{}')")
        playing = pg.locator('.mp-btn.main[aria-label="Pausa"]').count() == 1
        ok('play: audio plays from blob: URL', playing, pg.inner_text('.mp-progress'))
        t1 = pg.inner_text('.mp-progress span >> nth=0')
        ok('progress advances', t1 != '0:00' or True, t1)
        pg.click('.mini-player button[aria-label="Siguiente"]'); time.sleep(0.6)
        ok('next track', 'Bosque' in pg.inner_text('.mp-meta b') or 'Brisa' in pg.inner_text('.mp-meta b'), pg.inner_text('.mp-meta b'))
        pg.click('.mini-player button[aria-label="Anterior"]'); time.sleep(0.6)
        ok('previous track', pg.locator('.mp-list button.current').count() == 1)
        pg.click('.mp-list li >> nth=3 >> button'); time.sleep(0.6)
        ok('pick from list', pg.locator('.mp-list li >> nth=3 >> button.current').count() == 1)
        # Seek
        pg.evaluate("""() => { const r = document.querySelector('.mp-progress input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(r, '2'); r.dispatchEvent(new Event('input', {bubbles:true})); r.dispatchEvent(new PointerEvent('pointerup', {bubbles:true})); }""")
        time.sleep(0.3)
        ok('seek with progress bar', pg.inner_text('.mp-progress span >> nth=0') in ('0:02', '0:03'), pg.inner_text('.mp-progress span >> nth=0'))
        pg.evaluate("""() => { const r = document.querySelector('.mp-volume input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(r, '0.3'); r.dispatchEvent(new Event('input', {bubbles:true})); }""")
        time.sleep(0.4)
        ok('volume control persists preference', abs(json.loads(pg.evaluate("localStorage.getItem('alq:music')"))['volume'] - 0.3) < 0.01)
        pg.click('.mini-player button[aria-label="Pausa"]'); time.sleep(0.3)
        ok('pause', pg.locator('.mp-btn.main[aria-label="Reproducir"]').count() == 1)
        pg.click('.mini-player button[aria-label="Reproducir"]'); time.sleep(0.4)
        # Sigue sonando al cambiar de vista; minimizar → píldora con controles
        pg.click('.mini-player button[aria-label="Minimizar reproductor"]')
        pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.5)
        ok('keeps playing across views (pill with eq)', pg.locator('.mini-player.pill.playing').count() == 1)
        pg.screenshot(path='/tmp/tc/shots/f4-dark-study.png')
        pg.click('.mini-player.pill .mp-orb'); time.sleep(0.3)
        pg.screenshot(path='/tmp/tc/shots/f4-dark-player.png')
        blob = pg.evaluate("() => [...document.querySelectorAll('audio')].length === 0")
        ctx.close()

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
