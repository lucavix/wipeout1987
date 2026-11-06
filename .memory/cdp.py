"""Headless Chrome via CDP. Usage: cdp.py <outdir> <scenario>  (scenario: race | pit)"""
import asyncio, json, subprocess, sys, time, base64, urllib.request, websockets
OUT, SCEN = sys.argv[1], sys.argv[2]; URL = 'http://127.0.0.1:5187/'  # es. python3 -I .memory/cdp.py .memory/shots race; URL = 'http://127.0.0.1:5187/'
chrome = subprocess.Popen(['google-chrome', '--headless=new', '--remote-debugging-port=9333', '--window-size=1600,900',
                           '--no-first-run', '--no-sandbox', '--disable-gpu', '--user-data-dir=/tmp/claude-1000/cdp-profile', 'about:blank'],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9333/json')); break
    except Exception: time.sleep(0.2)
ws_url = [t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl']

async def main():
    async with websockets.connect(ws_url, max_size=2**26) as ws:
        n = 0
        async def call(method, **params):
            nonlocal n; n += 1
            await ws.send(json.dumps({'id': n, 'method': method, 'params': params}))
            while True:
                m = json.loads(await ws.recv())
                if m.get('id') == n: return m.get('result', m)
        async def js(expr):
            r = await call('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=True)
            return r.get('result', {}).get('value', r)
        async def key(code, k):
            for t in ('keyDown', 'keyUp'):
                await call('Input.dispatchKeyEvent', type=t, code=code, key=k, windowsVirtualKeyCode=13 if k == 'Enter' else 0)
            await asyncio.sleep(0.15)
        async def shot(name):
            r = await call('Page.captureScreenshot', format='jpeg', quality=85)
            open(f'{OUT}/{name}.jpg', 'wb').write(base64.b64decode(r['data']))
        player = 'dbg.ships.find(s=>!s.ai)'
        await call('Page.enable'); await call('Runtime.enable')
        await call('Page.navigate', url=URL); await asyncio.sleep(2.5)
        await key('Enter', 'Enter')                                   # class
        if SCEN == 'race': await key('ArrowDown', 'ArrowDown')        # Karbonis
        await key('Enter', 'Enter')                                   # track
        if SCEN == 'select':
            await asyncio.sleep(0.5); await shot('select'); print('mode', await js('dbg.mode')); print('errors', await js('(window.__errs||[]).length')); return
        await key('Enter', 'Enter')                                   # ship
        await asyncio.sleep(0.5)
        print('mode', await js('dbg.mode'), 'track', await js('dbg.track.data.name'))
        if SCEN == 'race':
            await js(f'dbg.auto.add({player})')
            t0 = time.time(); i = 0
            while time.time() - t0 < 40:
                await asyncio.sleep(4); i += 1
                await shot(f'race{i:02d}')
                print(await js(f'JSON.stringify({{lap:dbg.race.entry({player}).lap, kmh:Math.round({player}.speed*0.6), fps:dbg.fps(), expl:dbg.stats.explosions}})'))
        elif SCEN == 'pit':
            await asyncio.sleep(4)  # countdown
            k = await js(f"""(()=>{{const p={player}, pit=dbg.track.pit, k=Math.floor(pit.center.length/2); p.pos={{...pit.center[k]}}; p.heading=Math.atan2(pit.tangent[k].y,pit.tangent[k].x);
                p.vel={{x:0,y:0}}; p.speed=0; p.energy=20; p.hint=-1; dbg.input={{thrust:1,steer:0,airL:false,airR:false}}; return pit.center.length}})()""")
            print('pit samples', k)
            log = []
            for i in range(14):
                await asyncio.sleep(0.5)
                log.append(await js(f'(()=>{{const p={player};return [p.inPit?1:0, Math.round(p.energy), Math.round(p.speed*0.6)]}})()'))
                if i == 3: await shot('pit')
            print('inPit/energy/kmh every 0.5s:', log)
        elif SCEN == 'pitdbg':
            await asyncio.sleep(4)
            print(await js(f"""(()=>{{const p={player}, pit=dbg.track.pit, k=Math.floor(pit.center.length/2); p.pos={{...pit.center[k]}}; p.heading=Math.atan2(pit.tangent[k].y,pit.tangent[k].x); p.vel={{x:0,y:0}}; p.hint=-1; dbg.input={{thrust:0,steer:0,airL:false,airR:false}};
                const poly=pit.innerPolygon; const xs=poly.map(q=>q.x), ys=poly.map(q=>q.y);
                let md=1e9; for (const c of dbg.track.main.center) md=Math.min(md, Math.hypot(c.x-p.pos.x, c.y-p.pos.y));
                return JSON.stringify({{pos:p.pos, polyN:poly.length, bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)], mainDist:Math.round(md), pitWidth:pit.width}})}})()"""))
            await asyncio.sleep(0.5)
            print(await js(f'JSON.stringify({{inPit:{player}.inPit, pos:{player}.pos, dead:{player}.dead, s:{player}.s, d:{player}.d}})'))
        elif SCEN == 'select':
            pass  # screenshot of the ship-select screen is taken below
        print('errors', await js('(window.__errs||[]).length'))
asyncio.run(main())
chrome.terminate()
