"""Real production WebGL evidence for the bounded room13/17 camera fixes.

Room13 finishes via the existing ordinary-input route. Room17 replays one
captured ordinary-input prefix with real browser viewport changes between
the same update calls; it is deliberately a 2000-frame prefix, not a win.
No camera/actor/physics pose or puzzle state is injected.
"""
import base64
import functools
import hashlib
import http.server
import json
import os
import pathlib
import subprocess
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('CAMERA_PROOF_DIR', ROOT / 'qa/camera-recovery'))
OUT.mkdir(parents=True, exist_ok=True)
AFTER = pathlib.Path(os.environ.get('CANDIDATE_DIST', ROOT / 'dist')).resolve()
BEFORE = os.environ.get('BASELINE_DIST')
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/chromium')
TAPE_FILE = os.environ.get('CAMERA_INPUT_TAPE')
CASES = os.environ.get('CAMERA_CASES', '13-wide,13-portrait,17-resize').split(',')
report = {
    'sourceCommit': os.environ.get('BUILD_COMMIT', 'local-worktree'),
    'baselineCommit': os.environ.get('BASELINE_COMMIT', 'f0adf70b984c50d2306f72f307e8ba3475d43183'),
    'scope': 'Production software WebGL, native Play, original actors and ordinary input; '
             'not a physical device or human discovery. Room17 is a bounded 2000-visual-frame '
             'prefix with real browser viewport resize, not a full-room win.',
    'rows': [], 'pass': False,
}


def save():
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Site:
    def __init__(self, dist):
        self.directory = tempfile.TemporaryDirectory(prefix='camera-site-')
        (pathlib.Path(self.directory.name) / 'campaign-v67').symlink_to(dist, target_is_directory=True)
        self.server = http.server.ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(QuietHandler, directory=self.directory.name))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.server.server_port}/campaign-v67/'

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.directory.cleanup()


FIXTURE = """import {campaignAccessFixture} from './scripts/lib/campaign-access-fixture.mjs';
console.log(JSON.stringify(campaignAccessFixture({levelIndex:Number(process.argv[1])-1,pathname:'/campaign-v67/'})));"""


def launch(p, site, level, width, height, row):
    browser = p.chromium.launch(executable_path=CHROME, headless=True, args=[
        '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
        '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
    fixture = json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e', FIXTURE, str(level)], cwd=ROOT, text=True))
    fixture['preferences']['quality'] = 'balanced'
    context.add_init_script('localStorage.clear();localStorage.setItem(' + json.dumps(fixture['key'])
                            + ',' + json.dumps(json.dumps(fixture['preferences'])) + ');')
    page = context.new_page()
    page.set_default_timeout(180000)
    page.on('pageerror', lambda e: row['pageErrors'].append(str(e)))
    page.on('console', lambda m: row['consoleErrors'].append(m.text) if m.type == 'error' else None)
    page.goto(site.base + f'?edition=foundation&level={level}&debug=1', wait_until='domcontentloaded')
    page.wait_for_function("window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1'")
    page.evaluate("""()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__CAMERA_LOOP__=r.setAnimationLoop;
      r.setAnimationLoop=function(){return window.__CAMERA_LOOP__.call(this,null)};r.setAnimationLoop(null);}""")
    page.click('#play-button')
    page.wait_for_function("window.__NESI_DEMO_GAME__.state==='playing'")
    assert page.evaluate('window.__NESI_PREFS__.value.completed') == fixture['completed']
    page.evaluate("""()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__CAMERA_LOOP__;delete window.__CAMERA_LOOP__;
      if(g.elapsed!==0||g.physics.world.stepnumber!==0)throw Error('Not untouched native Play');}""")
    row['fixture'] = {'completed': fixture['completed'], 'targetCompleted': False}
    return browser, context, page, fixture


GUARDS = """()=>{
 const g=window.__NESI_DEMO_GAME__, original={player:g.playerGroup,cargo:g.cargo,group:g.cargo.group,
 body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],camera:g.camera,rig:g.cameraRig};
 const update=g.updatePlaying,visual=g.updateVisuals,fire=g.firePortal,interact=g.interact;
 const meshes=[];g.playerGroup.traverse(mesh=>{if(mesh.isMesh)meshes.push({mesh,geometry:mesh.geometry,
 position:mesh.geometry.attributes.position.array,index:mesh.geometry.index?.array,
 materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>({m,opacity:m.opacity,transparent:m.transparent,visible:m.visible,depthWrite:m.depthWrite}))});});
 const proof={original,meshes,frames:0,observations:0,resets:0,deletions:0,shots:[],controls:[],pictures:[]};
 proof.check=()=>{if(g.playerGroup!==original.player||g.cargo!==original.cargo||g.cargo.group!==original.group
  ||g.physics.cargoBody!==original.body||original.body.shapes[0]!==original.shape||g.camera!==original.camera||g.cameraRig!==original.rig)throw Error('Original actor/camera replaced');
  for(const m of meshes){if(m.mesh.geometry!==m.geometry||m.geometry.attributes.position.array!==m.position||m.geometry.index?.array!==m.index)throw Error('Original geometry changed');
   const ms=Array.isArray(m.mesh.material)?m.mesh.material:[m.mesh.material];for(let i=0;i<ms.length;i++){const a=ms[i],b=m.materials[i];if(a!==b.m||a.opacity!==b.opacity||a.transparent!==b.transparent||a.visible!==b.visible||a.depthWrite!==b.depthWrite)throw Error('Original material changed');}}
 };
 g.updatePlaying=function(...args){proof.check();proof.observations++;return update.apply(this,args);};
 g.updateVisuals=function(...args){proof.controls.push({move:g.input.getMove().toArray(),yaw:g.yaw,pitch:g.pitch,keys:[...g.input.keys].sort()});const v=visual.apply(this,args);proof.frames++;proof.check();return v;};
 g.resetRun=()=>{proof.resets++;throw Error('Reset forbidden after Play');};g.respawn=()=>{proof.resets++;throw Error('Respawn forbidden after Play');};g.physics.resetCargo=()=>{proof.resets++;throw Error('Cargo reset forbidden after Play');};
 g.clearPortals=()=>{proof.deletions++;throw Error('Hidden pair deletion forbidden');};
 const impact=g.portalShots.impact;g.portalShots.impact=function(...args){const r=impact.apply(this,args);proof.shots.push({...this.lastImpact});return r;};
 proof.sample=label=>{g.render();g.scene.updateMatrixWorld(true);const point=g.playerPosition.clone(),local=point.clone();
  let vertices=0,outside=0,minDepth=Infinity,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const {mesh}of meshes){if(mesh.isSkinnedMesh)mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);local.copy(point).applyMatrix4(g.camera.matrixWorldInverse);minDepth=Math.min(minDepth,-local.z);point.project(g.camera);vertices++;
    minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
    if(Math.abs(point.x)>1||Math.abs(point.y)>1||Math.abs(point.z)>1)outside++;
  }}
  const safe=g.camera.position.clone();g.cameraRig.constrain(g.cameraRig.playerPivot,safe,g.camera.fov);
  return{label,frame:proof.frames,worldStep:g.physics.world.stepnumber,state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
   eye:g.camera.position.toArray(),fov:g.camera.fov,aspect:g.camera.aspect,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],
   active:g.cameraRig.mechanismFramingActive,vertices,outside,minDepth,bounds:{minX,maxX,minY,maxY},sweepDisplacement:safe.distanceTo(g.camera.position),
   png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};};
 window.__CAMERA_PROOF__=proof;
}"""


def retain_picture(row, sample):
    data = base64.b64decode(sample.pop('png'))
    assert data.startswith(b'\x89PNG') and len(data) > 10000
    name = f"{row['version']}-{row['case']}-{sample['label']}.png"
    (OUT / name).write_bytes(data)
    sample.update(file=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    row.setdefault('samples', []).append(sample)
    save()


def room13(page, row):
    result = page.evaluate("""async()=>{
      const g=window.__NESI_DEMO_GAME__,proof=window.__CAMERA_PROOF__;
      const route=await window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true,order:'cargo-first'});
      return{route,observations:proof.observations,resets:proof.resets,deletions:proof.deletions,
       shots:proof.shots,sameOriginal:g.cargo===proof.original.cargo,state:g.state,
       sample:proof.sample('reunion')};}""")
    retain_picture(row, result.pop('sample'))
    row['result'] = result
    assert result['route']['pass'] and result['state'] == 'won' and result['sameOriginal']
    assert result['resets'] == result['deletions'] == result['route']['resets'] == result['route']['respawns'] == 0
    assert result['shots'] and all(shot['valid'] for shot in result['shots'])


def capture_tape(page):
    return page.evaluate("""async()=>{
      const g=window.__NESI_DEMO_GAME__,end=Symbol('bounded-prefix'),inputTape=[];
      const physics=g.updatePlaying,visual=g.updateVisuals,fire=g.firePortal,interact=g.interact;
      let inside=false,frames=0;
      const state=()=>({move:g.input.getMove().toArray(),yaw:g.yaw,pitch:g.pitch,keys:[...g.input.keys].sort(),jumpQueued:g.input.jumpQueued,interactQueued:g.interactQueued});
      const add=(type,args)=>inputTape.push({type,args,input:state()});
      g.updatePlaying=function(...a){add('physics',a);inside=true;try{return physics.apply(this,a);}finally{inside=false;}};
      g.firePortal=function(...a){if(!inside)add('fire',a);return fire.apply(this,a);};
      g.interact=function(...a){if(!inside)add('interact',a);return interact.apply(this,a);};
      g.updateVisuals=function(...a){add('visual',a);const r=visual.apply(this,a);if(++frames===2000)throw end;return r;};
      try{await window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true,firstMouthInspection:true});throw Error('Missing bounded endpoint');}
      catch(e){if(e!==end)throw e;}
      finally{g.updatePlaying=physics;g.updateVisuals=visual;g.firePortal=fire;g.interact=interact;}
      return{inputTape,visualFrames:frames,physicsSteps:g.physics.world.stepnumber,scope:'Production browser ordinary input prefix; not a completed room.'};
    }""")


def room17(page, row, tape):
    page.evaluate("""tape=>{const g=window.__NESI_DEMO_GAME__,proof=window.__CAMERA_PROOF__,vector=g.input.getMove().clone();
      proof.tape=tape;proof.cursor=0;
      proof.advance=(frame,before=false)=>{
        for(;proof.cursor<tape.length;proof.cursor++){
          const e=tape[proof.cursor];if(before&&e.type==='visual'&&proof.frames+1===frame)return;
          const i=e.input;g.input.getMove=()=>vector.clone().fromArray(i.move);g.input.keys=new Set(i.keys);
          g.input.jumpQueued=i.jumpQueued;g.interactQueued=i.interactQueued;g.yaw=i.yaw;g.pitch=i.pitch;
          if(e.type==='physics')g.updatePlaying(...e.args);else if(e.type==='visual')g.updateVisuals(...e.args);
          else if(e.type==='fire')g.firePortal(...e.args);else if(e.type==='interact')g.interact(...e.args);else throw Error('Unknown replay event');
          if(!before&&proof.frames===frame){proof.cursor++;return;}
        }
        if(proof.frames!==frame)throw Error('Tape ended early');
      };
    }""", tape['inputTape'])
    for frame in [1599, 1600, 1601, 1610, 1630, 1650, 1699, 1700, 1701, 1730, 1750, 2000]:
        if frame in [1600, 1700]:
            page.evaluate('frame=>window.__CAMERA_PROOF__.advance(frame,true)', frame)
            viewport = {'width': 390, 'height': 844} if frame == 1600 else {'width': 1280, 'height': 720}
            page.set_viewport_size(viewport)
            # Deliver the existing production resize handler at this precise
            # input boundary. Canvas inline dimensions can otherwise still
            # match the old lens for one queued browser resize task.
            page.evaluate("()=>dispatchEvent(new Event('resize'))")
            page.wait_for_function('size=>{const g=window.__NESI_DEMO_GAME__,c=g.container;return innerWidth===size.width&&innerHeight===size.height&&c.clientWidth===size.width&&Math.abs(g.camera.aspect-c.clientWidth/c.clientHeight)<1e-9}', arg=viewport)
        page.evaluate('frame=>window.__CAMERA_PROOF__.advance(frame)', frame)
        retain_picture(row, page.evaluate('label=>window.__CAMERA_PROOF__.sample(label)', f'frame-{frame}'))
    result = page.evaluate("""()=>{const p=window.__CAMERA_PROOF__,g=window.__NESI_DEMO_GAME__;p.check();
      return{bounded:true,frames:p.frames,physicsSteps:g.physics.world.stepnumber,events:p.cursor,
       observations:p.observations,resets:p.resets,deletions:p.deletions,shots:p.shots,state:g.state,controls:p.controls};}""")
    controls = result.pop('controls')
    result['controlsSha256'] = hashlib.sha256(json.dumps(controls, separators=(',', ':')).encode()).hexdigest()
    result['controlFrames'] = len(controls)
    row['result'] = result
    assert result['bounded'] and result['frames'] == 2000 and result['physicsSteps'] == 4000
    assert result['events'] == len(tape['inputTape'])
    assert result['resets'] == result['deletions'] == 0
    assert result['state'] == 'playing'
    assert all(shot['valid'] for shot in result['shots'])


sites = {}
try:
    sites['after'] = Site(AFTER)
    if BEFORE:
        sites['before'] = Site(pathlib.Path(BEFORE).resolve())
    with sync_playwright() as p:
        tape = json.loads(pathlib.Path(TAPE_FILE).read_text()) if TAPE_FILE else None
        if '17-resize' in CASES and tape is None:
            scratch = {'pageErrors': [], 'consoleErrors': []}
            browser, context, page, _ = launch(p, sites['after'], 17, 1280, 720, scratch)
            try:
                page.evaluate(GUARDS)
                tape = capture_tape(page)
                assert not scratch['pageErrors'] and not scratch['consoleErrors']
            finally:
                context.close(); browser.close()
        if tape is not None:
            raw = json.dumps(tape, ensure_ascii=False, separators=(',', ':')).encode()
            (OUT / 'room17-ordinary-input-tape.json').write_bytes(raw)
            report['room17InputTape'] = {'file': 'room17-ordinary-input-tape.json', 'bytes': len(raw),
                                       'sha256': hashlib.sha256(raw).hexdigest(), 'events': len(tape['inputTape'])}
        for version in ['before', 'after']:
            if version not in sites:
                continue
            for name in CASES:
                level = 13 if name.startswith('13-') else 17
                width, height = (390, 844) if name == '13-portrait' else (1280, 720)
                row = {'version': version, 'case': name, 'viewport': [width, height],
                       'pageErrors': [], 'consoleErrors': [], 'pass': False}
                report['rows'].append(row); save()
                browser = context = None
                try:
                    browser, context, page, fixture = launch(p, sites[version], level, width, height, row)
                    page.evaluate(GUARDS)
                    if level == 13:
                        room13(page, row)
                        assert page.evaluate('window.__NESI_PREFS__.value.completed') == fixture['completed'] + [12]
                    else:
                        room17(page, row, tape)
                        assert page.evaluate('window.__NESI_PREFS__.value.completed') == fixture['completed']
                    assert not row['pageErrors'] and not row['consoleErrors']
                    for sample in row['samples']:
                        assert sample['vertices'] == 96753
                        assert sample['minDepth'] > .1
                        assert sample['sweepDisplacement'] < 1e-8
                        if version == 'after':
                            assert sample['outside'] == 0, f"{name} {sample['label']}: {sample['outside']} original vertices outside"
                            assert sample['fov'] <= 96 + 1e-8
                    row['pass'] = True
                    print('PASS', version, name, flush=True)
                except Exception as e:
                    row['failure'] = str(e)
                    print('FAIL', version, name, str(e), flush=True)
                finally:
                    save()
                    if context: context.close()
                    if browser: browser.close()
    before17 = next((r for r in report['rows'] if r['version'] == 'before' and r['case'] == '17-resize'), None)
    after17 = next((r for r in report['rows'] if r['version'] == 'after' and r['case'] == '17-resize'), None)
    if before17 and after17:
        assert before17['result']['controlsSha256'] == after17['result']['controlsSha256']
        assert len(before17['samples']) == len(after17['samples'])
        for a, b in zip(before17['samples'], after17['samples']):
            assert a['frame'] == b['frame'] and a['worldStep'] == b['worldStep']
            assert abs(a['aspect'] - b['aspect']) < 1e-9 and a['canvas'] == b['canvas']
            assert max(abs(x-y) for x, y in zip(a['player'], b['player'])) < 1e-9
            assert max(abs(x-y) for x, y in zip(a['cargo'], b['cargo'])) < 1e-9
        report['room17SameInputAndPhysics'] = True
    report['pass'] = bool(report['rows']) and all(r['pass'] for r in report['rows'])
finally:
    save()
    for site in sites.values():
        site.close()
if not report['pass']:
    raise SystemExit(1)
