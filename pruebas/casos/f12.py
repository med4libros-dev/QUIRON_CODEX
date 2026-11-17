import threading, http.server, socketserver, functools, time, json, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k:None
class Q(socketserver.TCPServer): allow_reuse_address=True
URL = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4181/'
if URL.startswith('http'):
    srv=Q(('127.0.0.1',4181), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever,daemon=True).start()
res, errs, calls = {}, [], []
PG=[None]
def wait_calls(n, t=25):
    # Las peticiones interceptadas solo se procesan mientras hablamos con el navegador.
    end=time.time()+t
    while time.time()<end and len(calls)<n:
        PG[0].evaluate('1')
        PG[0].wait_for_timeout(250)
    return len(calls)>=n

def ok(n,c,x=''):
    res[n]=bool(c); print(('PASS ' if c else 'FAIL ')+n, str(x)[:170]); sys.stdout.flush()
KV="""(k)=>new Promise(r=>{const q=indexedDB.open('alquimia');q.onsuccess=()=>{const g=q.result.transaction('kv').objectStore('kv').get(k);g.onsuccess=()=>r(typeof g.result==='string'?JSON.parse(g.result):g.result??null)}})"""
QS={'questions':[{'vignette':'Masculino de 62 años con fiebre, tos y estertores. FR 26, SatO2 90%.','question':'¿Siguiente paso?','options':[{'text':'A','why':'No.'},{'text':'B','why':'Sí, GPC.'},{'text':'C','why':'No.'},{'text':'D','why':'No.'}],'correct':1,'page':2} for _ in range(3)]}
def gem(route):
    body=json.loads(route.request.post_data or '{}'); calls.append(('gemini', route.request.url, dict(route.request.headers), body))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(QS)}]},'finishReason':'STOP'}]}))
def claude(route):
    body=json.loads(route.request.post_data or '{}'); calls.append(('claude', route.request.url, dict(route.request.headers), body))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'content':[{'type':'text','text':json.dumps(QS)}]}))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1368,'height':912})
    PG[0]=pg
    pg.route('https://generativelanguage.googleapis.com/**', gem)
    pg.route('https://api.anthropic.com/**', claude)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_selector('.rail')
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Preferencias")'); pg.wait_for_selector('.prefs')
    ok('provider selector', pg.locator('.prefs .seg[aria-label="Motor de IA"] button').count()==2 and 'Gemini' in pg.inner_text('.prefs'))
    pg.click('.prefs .seg[aria-label="Motor de IA"] button:has-text("Gemini")'); time.sleep(0.2)
    ok('model switches with the provider', pg.input_value('.prefs input[aria-label^="Modelo de Gemini"]')=='gemini-2.5-flash')
    pg.fill('.prefs input[aria-label^="API key de Gemini"]','AIzaTEST123'); pg.click('.prefs button:has-text("Guardar")'); time.sleep(0.3)
    ok('gemini key saved', 'Clave de Gemini (Google) guardada' in pg.inner_text('.prefs'))
    st=pg.evaluate("()=>JSON.parse(localStorage.getItem('alq:settings'))")
    ok('keys kept apart', st['geminiKey']=='AIzaTEST123' and st['apiKey']=='' and st['aiProvider']=='gemini', {k:st[k] for k in ('aiProvider','geminiKey','apiKey')})
    pg.keyboard.press('Escape'); time.sleep(0.2)
    # genera con Gemini
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("GPC")'); pg.wait_for_selector('.temario')
    pg.fill('.temario input','neumonia adquirida'); pg.click('.temario-list li >> nth=0 >> button'); pg.wait_for_selector('.topic-sheet')
    pg.set_input_files('.topic-sheet input[type=file]',['/tmp/tc/043GER_Neumonia.pdf']); pg.wait_for_selector('.att'); time.sleep(0.8)
    pg.keyboard.press('Escape')
    pg.click('.rail-btn:has-text("Simulacros")'); pg.click('.exam-tabs button:has-text("Generar casos")'); time.sleep(0.4)
    ok('no key prompt when configured', pg.locator('.exam-setup input[aria-label="API key"]').count()==0)
    tid=[k for k,v in (pg.evaluate(KV,'topics') or {'info':{}})['info'].items() if v['attachments']][0]
    pg.select_option('.exam-setup select[aria-label="Tema"]', tid)
    pg.click('.exam-setup button.primary:has-text("Generar")'); wait_calls(1); time.sleep(0.5)
    g=[c for c in calls if c[0]=='gemini']
    ok('it calls Gemini, not Claude', len(g)==1 and not [c for c in calls if c[0]=='claude'], [c[0] for c in calls])
    if g:
        url, headers, body = g[0][1], g[0][2], g[0][3]
        ok('correct model and endpoint', 'models/gemini-2.5-flash:generateContent' in url, url)
        ok('key in the header', headers.get('x-goog-api-key')=='AIzaTEST123')
        ok('system + user sent', 'systemInstruction' in body and 'ENARM' in json.dumps(body['systemInstruction']) and '[p. ' in body['contents'][0]['parts'][0]['text'])
        ok('thinking disabled on flash', body['generationConfig'].get('thinkingConfig',{}).get('thinkingBudget')==0, body['generationConfig'])
    time.sleep(2.0)
    qs=(pg.evaluate(KV,'exam') or {}).get('questions') or []
    ok('Gemini questions land in the bank', len(qs)==3 and all(not q['reviewed'] for q in qs), len(qs))
    # vuelta a Claude
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Preferencias")'); pg.wait_for_selector('.prefs')
    pg.click('.prefs .seg[aria-label="Motor de IA"] button:has-text("Claude")'); time.sleep(0.2)
    ok('Claude has no key yet', pg.locator('.prefs input[aria-label^="API key de Claude"]').count()==1)
    pg.fill('.prefs input[aria-label^="API key de Claude"]','sk-ant-TEST'); pg.click('.prefs button:has-text("Guardar")'); time.sleep(0.3)
    pg.keyboard.press('Escape'); time.sleep(0.2)
    pg.click('.rail-btn:has-text("Simulacros")'); pg.click('.exam-tabs button:has-text("Generar casos")'); time.sleep(0.3)
    pg.click('.exam-setup button:has-text("Generar")'); time.sleep(2.5)
    ok('switching back uses Claude', len([c for c in calls if c[0]=='claude'])==1, [c[0] for c in calls])
    st=pg.evaluate("()=>JSON.parse(localStorage.getItem('alq:settings'))")
    ok('both keys kept', st['geminiKey']=='AIzaTEST123' and st['apiKey']=='sk-ant-TEST')
    real=[e for e in errs if 'favicon' not in e]
    print('errors', real[:4]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
