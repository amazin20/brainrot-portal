"""Exercise the production UI, real charges and original actors on repaired routes.
Prior-prefix saves admit an unfinished target. This is not a human playtest.
"""
import base64, functools, hashlib, http.server, json, os, pathlib, subprocess, tempfile, threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ.get('ROUTE_PROOF_DIR','evidence/route-access-native'))
OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('PAGE_BASE','http://127.0.0.1:4173/campaign-v67/')
server=None
if os.environ.get('ROUTE_DIST'):
 site=tempfile.TemporaryDirectory(prefix='brainrot-route-site-')
 pathlib.Path(site.name,'campaign-v67').symlink_to(pathlib.Path(os.environ['ROUTE_DIST']).resolve(),target_is_directory=True)
 class QuietHandler(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args): pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=site.name))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 BASE=f'http://127.0.0.1:{server.server_port}/campaign-v67/'
CASES=[(11,'clutch-wide',1280,720,{'route':'floor-feed'}),
 (11,'clutch-portrait',390,844,{'route':'floor-feed'}),
 (11,'turntable-wide',1280,720,{'route':'turntable-air'}),
 (11,'turntable-portrait',390,844,{'route':'turntable-air'}),
 (13,'scout-wide',1280,800,{'order':'scout-first'}),
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
assert CASES,'No native route cases selected'
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
    const mechanism=()=>{
     const s=g.firstLevel.state,d=s.outputDrive,w=s.flywheel?.wheel;if(!d)return null;
     const visible=s.door.mechanism.getLeafBoxes();
     const leafBoxes=s.door.colliders.map((c,i)=>{
      const solid=g.physics.solids.get(c.mesh.uuid),size=c.box.getSize(c.box.min.clone()).multiplyScalar(.5),center=c.box.getCenter(c.box.min.clone());
      if(!solid||solid.body.collisionFilterMask===0||c.enabled===false)throw Error('Gate leaf lost its physical collider');
      // The shared physics registry reshapes only beyond squared 1e-10 m.
      for(const axis of ['x','y','z'])if(Math.abs(solid.target[axis]-center[axis])>1e-7||Math.abs(solid.half[axis]-size[axis])>1.1e-5||Math.abs(solid.body.shapes[0].halfExtents[axis]-solid.half[axis])>1e-10||Math.abs(visible[i].min[axis]-c.box.min[axis])>1e-7||Math.abs(visible[i].max[axis]-c.box.max[axis])>1e-7)throw Error('Gate render, gameplay box and physics shape disagree');
      return{min:c.box.min.toArray(),max:c.box.max.toArray(),bodyId:solid.body.id,shapeId:solid.body.shapes[0].id};
     });
     return{power:s.flywheel.power,airflow:d.airflow,inputTorque:d.inputTorque,cover:d.cover.opening,coverClearance:d.cover.clearance,coverVelocity:d.cover.velocity,clutch:d.clutch,stroke:d.stroke,energyPerStroke:d.energyPerStroke,energy:w.energy,work:w.work,omega:w.omega,doorProgress:s.door.progress,hingeStroke:Math.abs(s.door.leaves[0].parent.rotation.y)/1.48,leafBoxes};
    };
    const cause={samples:0,liveInputSamples:0,outputSamples:0,workIntoStroke:0,marks:[]};
    g.updatePlaying=function(...a){
     if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape||g.playerGroup!==player)throw Error('Original actor replaced');
     const before=level===11?mechanism():null;observations++;const result=update.apply(this,a);
     if(level===11){
      const after=mechanism(),ds=after.stroke-before.stroke,dw=after.work-before.work;cause.samples++;
      if(after.power)cause.liveInputSamples++;
      for(const value of [after.stroke,after.inputTorque,after.energy,after.work,after.cover,after.hingeStroke])if(!Number.isFinite(value))throw Error('Nonfinite measured transmission state');
      if(Math.abs(after.hingeStroke-after.stroke)>1e-10)throw Error('Door hinge moved independently of output stroke');
      if(ds < -1e-10||dw < -1e-10)throw Error('Physical output or work reversed without a reset');
      if(ds>1e-10){
       if(!before.clutch||after.inputTorque!==0)throw Error('Output moved without the accessible disconnected-input clutch');
       if(ds*after.energyPerStroke>dw+1e-7)throw Error('Door stroke exceeds actual delivered work');
       if(before.energy-after.energy<dw-1e-7)throw Error('Output work was not debited from stored rotor energy');
       cause.outputSamples++;cause.workIntoStroke+=ds*after.energyPerStroke;
      }
     }
     return result;
    };
    g.resetRun=()=>{resets++;throw Error('Route reset forbidden');};g.clearPortals=()=>{deletions++;throw Error('Debug pair deletion forbidden');};
    g.portalShots.impact=function(...a){const v=impact.apply(this,a);shots.push({...this.lastImpact});return v;};
    window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{if(level===11)cause.marks.push({name:mark.name,mechanism:mechanism()});if(pictures.length<(level===11?8:3))pictures.push({mark,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});};
    try{const route=await window.__NESI_RUN_LEVEL_ROUTE__({...options,nativeStart:true});g.render();pictures.push({mark:{name:'Actual terminal state',state:g.state},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});return{route,observations,resets,deletions,shots,pictures,cause:level===11?cause:null,state:g.state,sameOriginal:g.cargo===cargo&&g.physics.cargoBody===body&&body.shapes[0]===shape,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};}
    catch(e){g.render();pictures.push({mark:{name:'Failure',state:g.state},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});return{error:String(e.stack||e),observations,resets,deletions,shots,pictures,cause:level===11?cause:null,state:g.state};}
    finally{g.updatePlaying=update;g.clearPortals=clear;g.resetRun=reset;g.portalShots.impact=impact;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
   }""",{'level':level,'options':options})
   for i,image in enumerate(result['pictures']):
    data=base64.b64decode(image.pop('png'));assert data.startswith(b'\x89PNG') and len(data)>10000
    filename=f'{level}-{name}-{i+1}.png';(OUT/filename).write_bytes(data);image.update(file=filename,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
   row['result']=result;save()
   assert not result.get('error'),result.get('error');assert result['route']['pass'] and result['state']=='won' and result['sameOriginal']
   assert result['resets']==result['deletions']==result['route']['resets']==result['route']['respawns']==0
   if level==11:
    names=['live airflow charges the isolated flywheel while the output stays still','stopped airflow lets the spring cover expose the clutch','manual clutch transfers stored rotation into the gate','stored rotation completes the physical gate stroke']
    marks=result['cause']['marks'];indices=[next(i for i,m in enumerate(marks) if m['name']==name) for name in names]
    assert indices==sorted(set(indices))
    charge,clear,coupled,opened=[marks[i]['mechanism'] for i in indices]
    assert charge['power'] and charge['energy']>0 and charge['stroke']==0 and not charge['clutch']
    assert not clear['power'] and clear['energy']>0 and clear['stroke']==0 and not clear['clutch']
    assert clear['cover']>=clear['coverClearance']
    assert coupled['clutch'] and not coupled['power'] and 0<coupled['stroke']<1
    assert opened['stroke']==opened['doorProgress']==1
    assert result['cause']['samples']==result['observations'] and result['cause']['liveInputSamples']>100 and result['cause']['outputSamples']>1
    assert abs(result['cause']['workIntoStroke']-opened['energyPerStroke'])<1e-6
   assert all(s['valid'] for s in result['shots']) and result['shots']
   assert page.evaluate('window.__NESI_PREFS__.value.completed')==fixture['completed']+[level-1]
   assert not row['pageErrors'] and not row['consoleErrors'];row['pass']=True;print('PASS',level,name,result['route']['frames'],flush=True)
  except Exception as e: row['failure']=str(e);print('FAIL',level,name,str(e),flush=True)
  finally: save();context.close();browser.close()
report['pass']=len(report['rows'])==len(CASES) and all(r['pass'] for r in report['rows']);save()
if server: server.shutdown();server.server_close();site.cleanup()
if not report['pass']:raise SystemExit(1)
