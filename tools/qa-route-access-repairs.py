"""Exercise the production UI, real charges and original actors on repaired routes.
Prior-prefix saves admit an unfinished target. This is not a human playtest.
"""
import base64, hashlib, json, os, pathlib, subprocess
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ.get('ROUTE_PROOF_DIR','evidence/route-access-native'))
OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('PAGE_BASE','http://127.0.0.1:4173/campaign-v67/')
CASES=[(13,'scout-wide',1280,800,{'order':'scout-first'}),
 (13,'cargo-wide',1280,720,{'order':'cargo-first'}),
 (16,'cargo-portrait',450,800,{'order':'cargo-first'}),
 (16,'scout-portrait',450,800,{'order':'scout-first'}),
 (35,'latches-portrait',390,844,{'route':'latches-before-freight'}),
 (35,'scout-portrait',390,844,{'route':'scout-before-second-latch'})]
if os.environ.get('ROUTE_LEVELS'):
 selected=set(map(int,os.environ['ROUTE_LEVELS'].split(',')));CASES=[c for c in CASES if c[0] in selected]
report={'sourceCommit':os.environ.get('BUILD_COMMIT','local-uncommitted-candidate'),
 'scope':'Production software WebGL and ordinary input at declared viewports, not a physical phone or human discovery. Prior-prefix save admits each unfinished target. No reset, debug pair deletion or actor replacement after Play.', 'rows':[], 'pass':False}
def save(): (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
fixture_code="import {campaignAccessFixture} from './scripts/lib/campaign-access-fixture.mjs';console.log(JSON.stringify(campaignAccessFixture({levelIndex:Number(process.argv[1])-1,pathname:'/campaign-v67/'})));"
with sync_playwright() as p:
 for level,name,width,height,options in CASES:
  row={'level':level,'name':name,'viewport':[width,height],'options':options,'pageErrors':[],'consoleErrors':[],'pass':False};report['rows'].append(row);save()
  browser=p.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
  try:
   fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',fixture_code,str(level)],cwd=ROOT,text=True));fixture['preferences']['quality']='balanced';fixture['raw']=json.dumps(fixture['preferences']);row['fixture']={'completed':fixture['completed'],'targetCompleted':False}
   context.add_init_script('localStorage.clear();localStorage.setItem('+json.dumps(fixture['key'])+','+json.dumps(fixture['raw'])+');')
   page=context.new_page();page.set_default_timeout(180000)
   page.on('pageerror',lambda e:row['pageErrors'].append(str(e)))
   page.on('console',lambda m:row['consoleErrors'].append(m.text) if m.type=='error' else None)
   page.goto(BASE+f'?edition=foundation&level={level}&debug=1',wait_until='domcontentloaded')
   page.wait_for_function("window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1'")
   page.evaluate("()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__ROUTE_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__ROUTE_LOOP__.call(this,null)};r.setAnimationLoop(null);}")
   page.click('#play-button');page.wait_for_function("window.__NESI_DEMO_GAME__.state==='playing'")
   assert page.evaluate('window.__NESI_PREFS__.value.completed')==fixture['completed']
   result=page.evaluate("""async({level,options})=>{
    const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__ROUTE_LOOP__;delete window.__ROUTE_LOOP__;
    if(g.levelIndex!==level-1||g.elapsed!==0||g.physics.world.stepnumber!==0)throw Error('Not untouched target Play');
    const cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],player=g.playerGroup,update=g.updatePlaying,clear=g.clearPortals,reset=g.resetRun,impact=g.portalShots.impact;
    let observations=0,resets=0,deletions=0;const shots=[],pictures=[];
    g.updatePlaying=function(...a){if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape||g.playerGroup!==player)throw Error('Original actor replaced');observations++;return update.apply(this,a);};
    g.resetRun=()=>{resets++;throw Error('Route reset forbidden');};g.clearPortals=()=>{deletions++;throw Error('Debug pair deletion forbidden');};
    g.portalShots.impact=function(...a){const v=impact.apply(this,a);shots.push({...this.lastImpact});return v;};
    window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{if(pictures.length<3)pictures.push({mark,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});};
    try{const route=await window.__NESI_RUN_LEVEL_ROUTE__({...options,nativeStart:true});g.render();pictures.push({mark:{name:'Actual terminal state',state:g.state},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});return{route,observations,resets,deletions,shots,pictures,state:g.state,sameOriginal:g.cargo===cargo&&g.physics.cargoBody===body&&body.shapes[0]===shape,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};}
    catch(e){g.render();pictures.push({mark:{name:'Failure',state:g.state},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});return{error:String(e.stack||e),observations,resets,deletions,shots,pictures,state:g.state};}
    finally{g.updatePlaying=update;g.clearPortals=clear;g.resetRun=reset;g.portalShots.impact=impact;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
   }""",{'level':level,'options':options})
   for i,image in enumerate(result['pictures']):
    data=base64.b64decode(image.pop('png'));assert data.startswith(b'\x89PNG') and len(data)>10000
    filename=f'{level}-{name}-{i+1}.png';(OUT/filename).write_bytes(data);image.update(file=filename,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
   row['result']=result;save()
   assert not result.get('error'),result.get('error');assert result['route']['pass'] and result['state']=='won' and result['sameOriginal']
   assert result['resets']==result['deletions']==result['route']['resets']==result['route']['respawns']==0
   assert all(s['valid'] for s in result['shots']) and result['shots']
   assert page.evaluate('window.__NESI_PREFS__.value.completed')==fixture['completed']+[level-1]
   assert not row['pageErrors'] and not row['consoleErrors'];row['pass']=True;print('PASS',level,name,result['route']['frames'],flush=True)
  except Exception as e: row['failure']=str(e);print('FAIL',level,name,str(e),flush=True)
  finally: save();context.close();browser.close()
report['pass']=len(report['rows'])==len(CASES) and all(r['pass'] for r in report['rows']);save()
if not report['pass']:raise SystemExit(1)
