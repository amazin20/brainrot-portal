"""Native production WebGL and input-only routes, not rendered concept art.
Mount both production builds at /campaign-v67/ before running this script.
"""
import os,json,base64,hashlib,pathlib,subprocess
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ.get('OUT_DIR','qa/biosphere-remaster'))
LEVELS=[int(x) for x in os.environ.get('LEVELS','21,22,23,24,25,26,27,28,29,30').split(',')]
VERSIONS=os.environ.get('VERSIONS','before,after').split(',')
ROUTES=os.environ.get('ROUTES','0')=='1'
OUT.mkdir(parents=True,exist_ok=True)
refs=json.loads((ROOT/'tools/visual-audit-v65-reference-cameras.json').read_text())
code="import {campaignAccessFixture} from './scripts/lib/campaign-access-fixture.mjs';const f=campaignAccessFixture({levelIndex:Number(process.argv[1])-1,pathname:'/campaign-v67/'});f.preferences.quality='balanced';f.raw=JSON.stringify(f.preferences);console.log(JSON.stringify(f));"
report={'scope':'Native software WebGL. Prior-prefix access fixture; target unfinished. Static views move only camera. Routes use retained input driver, not human playtest or hardware benchmark.','rows':[],'pass':False}
def save(): (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def image(data,name):
 b=base64.b64decode(data);assert b.startswith(b'\x89PNG') and len(b)>10000
 (OUT/name).write_bytes(b);return {'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for version in VERSIONS:
  for level in LEVELS:
   row={'version':version,'level':level,'errors':[],'consoleErrors':[],'views':[],'pass':False};report['rows'].append(row)
   ctx=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=1)
   f=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(level)],cwd=ROOT,text=True));row['fixture']=f
   ctx.add_init_script('localStorage.clear();localStorage.setItem('+json.dumps(f['key'])+','+json.dumps(f['raw'])+');')
   page=ctx.new_page();page.set_default_timeout(180000)
   page.on('pageerror',lambda e:row['errors'].append(str(e)))
   page.on('console',lambda m:row['consoleErrors'].append(m.text) if m.type=='error' else None)
   try:
    port=os.environ.get('BEFORE_PORT','4174') if version=='before' else os.environ.get('AFTER_PORT','4173')
    page.goto(f'http://127.0.0.1:{port}/campaign-v67/?edition=foundation&level={level}&debug=1',wait_until='domcontentloaded')
    page.wait_for_function("window.__NESI_DEMO_GAME__?.state==='ready' && !document.querySelector('#start-screen').inert && getComputedStyle(document.querySelector('#start-screen')).opacity==='1'")
    page.evaluate("()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__BIO_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__BIO_LOOP__.call(this,null)};r.setAnimationLoop(null);}")
    page.click('#play-button');page.wait_for_function("window.__NESI_DEMO_GAME__.state==='playing'")
    ref=next(r for r in refs['levels'] if r['stableLevel']==level)
    for view in [{'kind':'start'},*ref['views'][:2]]:
     result=page.evaluate("""view=>{const g=window.__NESI_DEMO_GAME__,c=g.camera,state=()=>({id:g.firstLevel.id,index:g.levelIndex,steps:g.physics.world.stepnumber,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),state:g.state});const before=state();if(view.camera){c.position.fromArray(view.camera);c.lookAt(...view.target);c.fov=view.fov;c.updateProjectionMatrix();}else g.updateVisuals(0,1,0);c.updateMatrixWorld(true);g.render();return {before,after:state(),camera:{p:c.position.toArray(),q:c.quaternion.toArray(),fov:c.fov},stats:g.firstLevel.biosphereArchitecture?.stats,render:{calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};}""",view)
     assert result['before']==result['after'] and result['before']['steps']==0 and result['before']['index']==level-1
     result.update(image(result.pop('png'),f'{version}-{level}-{view["kind"]}.png'));row['views'].append(result);save()
    assert page.evaluate('window.__NESI_PREFS__.value.completed')==f['completed']
    if ROUTES:
     result=page.evaluate("""async()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__BIO_LOOP__;delete window.__BIO_LOOP__;const body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo,group=cargo.group,update=g.updatePlaying;let observations=0;g.updatePlaying=function(...a){if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape)throw Error('Original actor changed');observations++;return update.apply(this,a);};try{return {route:await window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true}),state:g.state,observations,sameBody:g.physics.cargoBody===body,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};}catch(e){return {error:String(e.stack||e),state:g.state,observations};}finally{g.updatePlaying=update;}}""")
     if result.get('png'):result['image']=image(result.pop('png'),f'{version}-{level}-won.png')
     row['route']=result;save();assert not result.get('error'),result.get('error');assert result['state']=='won' and result['route']['pass'];assert result['route']['resets']==0 and result['route']['respawns']==0
    assert not row['errors'],row['errors'];assert not row['consoleErrors'],row['consoleErrors'];row['pass']=True
    print('PASS',version,level,'routes' if ROUTES else 'views',flush=True)
   except Exception as e:
    row['failure']=str(e);print('FAIL',version,level,str(e),flush=True)
   finally:save();ctx.close()
 browser.close()
report['pass']=all(r['pass'] for r in report['rows']);save()
if not report['pass']:raise SystemExit(1)
