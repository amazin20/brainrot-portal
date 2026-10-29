"""Matched native WebGL views of observatory finishes with shadows enabled.

The native views use untouched production settings. Explicitly named light
controls are diagnostics only, restored before a second untouched render.
This static inspection is not a room win, human playtest or hardware FPS run.
"""
import base64
import functools
import hashlib
import http.server
import json
import math
import os
import pathlib
import statistics
import subprocess
import tempfile
import threading
import gzip
import time

from PIL import Image, ImageFilter, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STARTED = time.monotonic()
OUT = pathlib.Path(os.environ.get('SURFACE_PROOF_DIR', ROOT / 'qa/observatory-surface'))
OUT.mkdir(parents=True, exist_ok=True)
LEVELS = list(map(int, os.environ.get('SURFACE_LEVELS', '31,32,33,34,35,36,37,38,39,40').split(',')))
QUALITIES = os.environ.get('SURFACE_QUALITIES', 'balanced,high').split(',')
PROBE_ONLY = os.environ.get('SURFACE_PROBE_ONLY') == '1'
DIAGNOSTICS = os.environ.get('SURFACE_DIAGNOSTICS', '1') == '1'
assert all(31 <= x <= 40 for x in LEVELS)
assert all(x in ['balanced', 'high'] for x in QUALITIES)
assert len(set(LEVELS)) == len(LEVELS) and len(set(QUALITIES)) == len(QUALITIES)
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
report = {'sourceCommit': os.environ.get('BUILD_COMMIT', 'local-worktree'),
          'baselineCommit': os.environ.get('BASELINE_COMMIT', 'eb976be2b21153c6a98efa65c2adf1fd5e656b3b'),
          'scope': 'Matched static native production WebGL views after Play and one ordinary idle frame. '
                   'No actors, camera poses, puzzle states, geometry or materials are assigned. '
                   'Named shadow/light controls are diagnostics only; final native views use the authored policy. '
                   'Room31 contact inspections add 36 ordinary idle visual frames for physical settling, then 36 '
                   'ordinary look-down input frames at pitch -0.6 to expose its support floor. '
                   'Not a room win, human playtest or hardware performance measurement.',
          'diagnosticOnly': PROBE_ONLY, 'rows': [], 'pass': False}
report['sourceFiles'] = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                        for path in [ROOT / 'src/game/LabObservatoryShadows.js', ROOT / 'src/game/LabOpticsArchitecture.js',
                                     ROOT / 'src/game/LabVisualAuditObservatory.js', pathlib.Path(__file__).resolve()]
                        if path.is_file()}


def save():
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def pixels(image):
    return list(image.get_flattened_data()) if hasattr(image, 'get_flattened_data') else list(image.getdata())


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Site:
    def __init__(self, dist):
        self.directory = tempfile.TemporaryDirectory(prefix='observatory-site-')
        (pathlib.Path(self.directory.name) / 'campaign-v67').symlink_to(pathlib.Path(dist).resolve(), target_is_directory=True)
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=self.directory.name))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.server.server_port}/campaign-v67/'

    def close(self):
        self.server.shutdown(); self.server.server_close(); self.directory.cleanup()


FIXTURE = """import {campaignAccessFixture} from './scripts/lib/campaign-access-fixture.mjs';
console.log(JSON.stringify(campaignAccessFixture({levelIndex:Number(process.argv[1])-1,pathname:'/campaign-v67/'})));"""


def start(browser, site, level, quality, row):
    context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
    fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', FIXTURE, str(level)], cwd=ROOT, text=True))
    fixture['preferences']['quality'] = quality
    context.add_init_script('localStorage.clear();localStorage.setItem(' + json.dumps(fixture['key']) + ',' + json.dumps(json.dumps(fixture['preferences'])) + ');')
    page = context.new_page(); page.set_default_timeout(180000)
    page.on('pageerror', lambda e: row['pageErrors'].append(str(e)))
    page.on('console', lambda m: row['consoleErrors'].append(m.text) if m.type == 'error' else None)
    page.on('requestfailed', lambda r: row['requestErrors'].append({'url': r.url, 'error': r.failure}))
    page.goto(site.base + f'?edition=foundation&level={level}&debug=1', wait_until='domcontentloaded')
    page.wait_for_function("window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1'")
    assert page.evaluate('window.__NESI_PREFS__.value.completed') == fixture['completed']
    page.evaluate("""()=>{const g=window.__NESI_DEMO_GAME__,r=g.renderer;window.__SURFACE_LOOP__=r.setAnimationLoop;
      r.setAnimationLoop=function(){return window.__SURFACE_LOOP__.call(this,null)};r.setAnimationLoop(null);}""")
    page.click('#play-button'); page.wait_for_function("window.__NESI_DEMO_GAME__.state==='playing'")
    page.evaluate("""()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__SURFACE_LOOP__;delete window.__SURFACE_LOOP__;
      if(g.elapsed!==0||g.physics.world.stepnumber!==0)throw Error('Not native zero-step Play');
      const original={player:g.playerGroup,cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0]};
      const actors=[];for(const root of [g.playerGroup,g.cargo.group])root.traverse(mesh=>{if(mesh.isMesh)actors.push({mesh,geometry:mesh.geometry,position:mesh.geometry.attributes.position.array,material:mesh.material});});
      const state=()=>({player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),steps:g.physics.world.stepnumber,state:g.state,id:g.firstLevel.id,
        camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov:g.camera.fov,aspect:g.camera.aspect},
        canvas:[g.renderer.domElement.width,g.renderer.domElement.height],quality:g.quality});
      const check=()=>{if(g.playerGroup!==original.player||g.cargo!==original.cargo||g.cargo.group!==original.group||g.physics.cargoBody!==original.body||original.body.shapes[0]!==original.shape)throw Error('Original actors replaced');
        for(const a of actors)if(a.mesh.geometry!==a.geometry||a.geometry.attributes.position.array!==a.position||a.mesh.material!==a.material)throw Error('Original actor geometry/material replaced');};
      g.resetRun=()=>{throw Error('Reset after Play forbidden');};g.respawn=()=>{throw Error('Respawn forbidden');};g.physics.resetCargo=()=>{throw Error('Original cargo reset forbidden');};g.clearPortals=()=>{throw Error('Hidden portal deletion forbidden');};
      g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);check();
      const light=g.keyLight,shadow=light.shadow,camera=shadow.camera,keys=['left','right','top','bottom','near','far'];
      const saved={position:light.position.clone(),target:light.target.position.clone(),castShadow:light.castShadow,bias:shadow.bias,normalBias:shadow.normalBias,camera:Object.fromEntries(keys.map(k=>[k,camera[k]]))};
      const effectiveVisible=m=>{if(m.userData.collisionProxy)return false;for(let p=m;p;p=p.parent)if(!p.visible)return false;
        return(Array.isArray(m.material)?m.material:[m.material]).some(a=>a.visible&&a.opacity>0&&a.colorWrite!==false);};
      const lighting=()=>{let casts=0,receives=0,contacts=0;g.scene.traverse(m=>{if(m.isMesh&&effectiveVisible(m)){casts+=Number(m.castShadow);receives+=Number(m.receiveShadow);if(m.name==='Soft contact on actual support')contacts++;}});
        return{position:light.position.toArray(),target:light.target.position.toArray(),intensity:light.intensity,color:light.color.getHex(),castShadow:light.castShadow,
          rendererEnabled:g.renderer.shadowMap.enabled,mapSize:shadow.mapSize.toArray(),bias:shadow.bias,normalBias:shadow.normalBias,frustum:Object.fromEntries(keys.map(k=>[k,camera[k]])),visibleCasters:casts,visibleReceivers:receives,visibleContacts:contacts,
          policy:g.firstLevel.observatoryShadow?.report??null};};
      const actorCoverage=()=>{const p=g.playerPosition.clone(),out=[];g.scene.updateMatrixWorld(true);
        for(const [name,root]of [['player',g.playerGroup],['cargo',g.cargo.group]]){let vertices=0,outsideXY=0,behindNear=0,beyondFar=0;
          root.traverse(mesh=>{if(!mesh.isMesh)return;if(mesh.isSkinnedMesh)mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
            mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);vertices++;
            outsideXY+=Number(p.x<camera.left||p.x>camera.right||p.y<camera.bottom||p.y>camera.top);behindNear+=Number(-p.z<camera.near);beyondFar+=Number(-p.z>camera.far);
          }});out.push({name,vertices,outsideXY,behindNear,beyondFar});}return out;};
      const render=()=>{shadow.needsUpdate=true;g.renderer.shadowMap.needsUpdate=true;g.render();check();return{state:state(),lighting:lighting(),png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};};
      const restore=()=>{light.position.copy(saved.position);light.target.position.copy(saved.target);light.castShadow=saved.castShadow;shadow.bias=saved.bias;shadow.normalBias=saved.normalBias;Object.assign(camera,saved.camera);camera.updateProjectionMatrix();};
      const fit=(move=0)=>{if(move){const direction=light.position.clone().sub(light.target.position).normalize().multiplyScalar(move);light.position.add(direction);light.target.position.add(direction);}
        g.scene.updateMatrixWorld(true);shadow.updateMatrices(light);const k=g.firstLevel.workshop,b=k.bounds,p=g.playerPosition.clone();let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
        for(const x of [b.minX-2,b.maxX+2])for(const y of [k.base-2,k.ceiling+2])for(const z of [b.minZ-2,b.maxZ+2]){p.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);p.toArray().forEach((v,i)=>{min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v);});}
        Object.assign(camera,{left:Math.floor(min[0]-1),right:Math.ceil(max[0]+1),bottom:Math.floor(min[1]-1),top:Math.ceil(max[1]+1),near:Math.max(1,Math.floor(-max[2]-2)),far:Math.ceil(-min[2]+2)});camera.updateProjectionMatrix();
        return Math.max(camera.right-camera.left,camera.top-camera.bottom)/shadow.mapSize.x;};
      const pixel=point=>{point.project(g.camera);return[(point.x+1)*g.renderer.domElement.width/2,(1-point.y)*g.renderer.domElement.height/2];};
      const wallSurface=()=>{const ray=g.raycaster,old={origin:ray.ray.origin.clone(),direction:ray.ray.direction.clone(),near:ray.near,far:ray.far};
        try{ray.near=0;ray.far=Infinity;ray.setFromCamera(g.input.getMove().clone().set(990/1280*2-1,1-77.5/720*2),g.camera);
          return ray.intersectObjects(g.scene.children,true).filter(h=>effectiveVisible(h.object)).slice(0,6).map(h=>({name:h.object.name,material:Array.isArray(h.object.material)?h.object.material.map(m=>m.name):h.object.material.name,
            point:h.point.toArray(),normal:h.face?.normal.toArray(),castShadow:h.object.castShadow,receiveShadow:h.object.receiveShadow}));
        }finally{ray.ray.origin.copy(old.origin);ray.ray.direction.copy(old.direction);ray.near=old.near;ray.far=old.far;}};
      const contact=(look=false)=>{if(look)g.pitch=-.6;
        for(let n=0;n<36;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);check();}
        g.render();const c=g.cargo.position,b=g.physics.cargoBody;b.updateAABB();const feet=b.aabb.lowerBound.y,support=g.floorHeight(c.x,c.z,feet+.15,true),p=c.clone();
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;g.cargo.group.traverse(m=>{if(!m.isMesh)return;for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);const[x,y]=pixel(p);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}});
        const polygon=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>pixel(p.set(x,support,z)));
        const projectedMeshes=[];
        for(const root of [g.playerGroup,g.cargo.group])root.traverse(m=>{if(!m.isMesh||!effectiveVisible(m))return;
          if(m.isSkinnedMesh)m.skeleton.update();const vertices=[];for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);vertices.push(pixel(p));}
          projectedMeshes.push({vertices,indices:m.geometry.index?Array.from(m.geometry.index.array):null});});
        const casters=[];g.cargo.group.traverse(m=>{if(m.isMesh)casters.push([m,m.castShadow]);});
        return{input:look?{kind:'ordinary-look-down',pitch:-.6,visualFrames:36,physicsSteps:72}:{kind:'ordinary-idle',visualFrames:36,physicsSteps:72},
          grounded:g.physics.grounded,supportY:support,bodyBottom:feet,gap:feet-support,cargoBounds:[minX,minY,maxX,maxY],
          floorPolygon:polygon(c.x-1.8,c.x+1.8,c.z-1.8,c.z+1.8),basePolygon:polygon(b.aabb.lowerBound.x,b.aabb.upperBound.x,b.aabb.lowerBound.z,b.aabb.upperBound.z),
          projectedMeshes,casterCount:casters.filter(([,v])=>v).length,castOff(){casters.forEach(([m])=>m.castShadow=false);},castRestore(){casters.forEach(([m,v])=>m.castShadow=v);}};};
      window.__SURFACE_PROOF__={state,check,lighting,render,restore,fit,saved,actorCoverage,contact,wallSurface};
    }""")
    return context, page, fixture


def picture(row, label, capture):
    data = base64.b64decode(capture.pop('png'))
    assert data.startswith(b'\x89PNG') and len(data) > 10000
    name = f"{row['version']}-{row['level']}-{row['quality']}-{label}.png"
    digest = hashlib.sha256(data).hexdigest()
    previous = next((v for v in row.get('captures', {}).values() if v['sha256'] == digest), None)
    if previous: name = previous['file']
    path = OUT / name
    if not path.exists(): path.write_bytes(data)
    with Image.open(path) as image:
        image.load(); assert image.size == (1280, 720)
        if row['level'] == 31 and row.get('inspection') != 'ordinary-look-down':
            # Fixed plain-blue field in the declared 1280x720 native view.
            # Keep seam/trim/actor edges outside this diagnostic-only ROI.
            gray = image.convert('L'); box = (910, 35, 1070, 120)
            values = pixels(gray.crop(box)); blur = pixels(gray.filter(ImageFilter.GaussianBlur(2)).crop(box))
            high = [a-b for a, b in zip(values, blur)]
            capture['flatWallRoi'] = {'box': list(box), 'meanLuma': statistics.mean(values),
                 'highPassRms': math.sqrt(statistics.mean(v*v for v in high)),
                 'highPassAbsMean': statistics.mean(abs(v) for v in high), 'stdLuma': statistics.pstdev(values)}
    capture.update(file=name, bytes=len(data), sha256=digest)
    row.setdefault('captures', {})[label] = capture; save()
    return capture


def controls(page, row):
    variants = [('shadow-off-control', 'off', 0)]
    if PROBE_ONLY: variants += [('fit-only-control', 'fit', 0),
            ('fit-half-texel-control', 'fit', .5), ('fit-one-texel-control', 'fit', 1),
            ('fit-one-half-texel-control', 'fit', 1.5), ('full-depth-control', 'full', 1)]
    for label, mode, normal in variants:
        cap = page.evaluate("""({mode,normal})=>{const p=window.__SURFACE_PROOF__,g=window.__NESI_DEMO_GAME__;p.restore();
          if(mode==='off')g.keyLight.castShadow=false;
          else{const texel=p.fit(mode==='full'?25:0);if(normal){g.keyLight.shadow.normalBias=texel*normal;g.keyLight.shadow.bias=-.25*texel/(g.keyLight.shadow.camera.far-g.keyLight.shadow.camera.near);}}
          const r=p.render();r.diagnosticOnly=true;return r;}""", {'mode': mode, 'normal': normal})
        picture(row, label, cap)
    page.evaluate('()=>window.__SURFACE_PROOF__.restore()')


def contact_metrics(row, contact, precise=True):
    normal = Image.open(OUT / row['captures']['grounded-contact']['file']).convert('L')
    off = Image.open(OUT / row['captures']['cargo-casters-off-control']['file']).convert('L')
    mask = Image.new('L', normal.size); draw = ImageDraw.Draw(mask)
    draw.polygon([tuple(p) for p in contact['floorPolygon']], fill=255)
    if precise:
        silhouette = Image.new('L', normal.size); raster = ImageDraw.Draw(silhouette)
        triangles = 0
        for mesh in contact['projectedMeshes']:
            v = mesh['vertices']; indices = mesh['indices'] if mesh['indices'] is not None else list(range(len(v)))
            for i in range(0, len(indices)-2, 3):
                points = [tuple(v[indices[i+j]]) for j in range(3)]
                if all(all(math.isfinite(c) for c in p) for p in points): raster.polygon(points, fill=255); triangles += 1
        silhouette = silhouette.filter(ImageFilter.MaxFilter(3))
        mask.paste(0, (0, 0), silhouette)
        name = f"{row['version']}-{row['level']}-{row['quality']}-support-visible-mask.png"; mask.save(OUT / name)
        row['contactMask'] = {'file': name, 'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest(), 'projectedOriginalTriangles': triangles,
                              'scope': 'Projected support polygon minus both original actor triangle silhouettes with one pixel antialiasing margin; no scene override or hidden actor.'}
    else:
        x0, y0, x1, y1 = contact['cargoBounds']; draw.rectangle((x0-1, y0-1, x1+1, y1+1), fill=0)
    a, b, m = pixels(normal), pixels(off), pixels(mask)
    points = [(i % normal.width, i // normal.width, bright-dark) for i, (dark, bright, keep) in enumerate(zip(a, b, m)) if keep and bright-dark >= 2]
    def segment_distance(point, start, end):
        x, y = point; ax, ay = start; bx, by = end; dx, dy = bx-ax, by-ay
        t = max(0, min(1, ((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
        return math.hypot(x-ax-t*dx, y-ay-t*dy)
    poly = contact['basePolygon']
    gap = min((min(segment_distance((x, y), poly[i], poly[(i+1) % 4]) for i in range(4)) for x, y, _ in points), default=None)
    def inside(point):
        x, y = point; result = False
        for i, (ax, ay) in enumerate(poly):
            bx, by = poly[(i+1) % len(poly)]
            if (ay > y) != (by > y) and x < ax+(y-ay)*(bx-ax)/(by-ay): result = not result
        return result
    interior = sum(inside((x, y)) for x, y, _ in points)
    return {'floorShadowPixels': len(points), 'maxShadowLuma': max((v for _, _, v in points), default=0),
            'meanShadowLuma': statistics.mean(v for _, _, v in points) if points else 0,
            'nearestFootprintEdgePixels': gap, 'nearestFootprintGapPixels': 0 if interior else gap, 'pixelsInsidePhysicalFootprint': interior,
            'scope': 'Only cargo caster contribution on the projected support patch outside original actors; unchanged soft-contact decals cancel in this difference. Gap is zero for a shadow pixel inside the actual physical footprint; distance to its boundary alone is not a detachment measurement.',
            'exclusion': 'Actual projected original triangle silhouettes plus one pixel antialiasing margin' if precise else 'Coarse cargo image bounding rectangle (retained diagnostic; it incorrectly excludes visible floor inside that rectangle)'}


def contact_control(page, row, look=False):
    contact = page.evaluate("""look=>{const p=window.__SURFACE_PROOF__,c=p.contact(look);p.contactState=c;
       return{input:c.input,grounded:c.grounded,supportY:c.supportY,bodyBottom:c.bodyBottom,gap:c.gap,cargoBounds:c.cargoBounds,floorPolygon:c.floorPolygon,basePolygon:c.basePolygon,casterCount:c.casterCount,projectedMeshes:c.projectedMeshes};}""", look)
    row['contact'] = {k: v for k, v in contact.items() if k != 'projectedMeshes'}
    raw = gzip.compress(json.dumps(contact['projectedMeshes'], separators=(',', ':')).encode(), mtime=0)
    name = f"{row['version']}-{row['level']}-{row['quality']}-original-projected-triangles.json.gz"; (OUT / name).write_bytes(raw)
    row['contact']['projectionFile'] = {'file': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    assert contact['grounded'] and abs(contact['gap']) < .06 and contact['casterCount'] > 0
    original = picture(row, 'grounded-contact', page.evaluate('()=>window.__SURFACE_PROOF__.render()'))
    cap = page.evaluate("""()=>{const p=window.__SURFACE_PROOF__;p.contactState.castOff();const r=p.render();r.diagnosticOnly=true;return r;}""")
    picture(row, 'cargo-casters-off-control', cap)
    restored = picture(row, 'restored-contact', page.evaluate('()=>{const p=window.__SURFACE_PROOF__;p.contactState.castRestore();return p.render();}'))
    assert original['state'] == restored['state'] and original['lighting'] == restored['lighting'] and original['sha256'] == restored['sha256']
    row['contactMetrics'] = contact_metrics(row, contact)
    row['coarseContactMetrics'] = contact_metrics(row, contact, precise=False)
    assert row['contactMetrics']['floorShadowPixels'] >= (12 if look else 1), 'No measurable cargo shadow on its actual support patch'
    assert row['contactMetrics']['maxShadowLuma'] >= 2


sites = {}
try:
    baseline = os.environ.get('BASELINE_DIST')
    if baseline: sites['before'] = Site(baseline)
    if not PROBE_ONLY: sites['after'] = Site(os.environ.get('CANDIDATE_DIST', ROOT / 'dist'))
    if PROBE_ONLY and not baseline: raise ValueError('Diagnostic-only mode needs BASELINE_DIST')
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        try:
            for version, site in sites.items():
                for level in LEVELS:
                    for quality in QUALITIES:
                        row_started = time.monotonic()
                        row = {'version': version, 'level': level, 'quality': quality, 'pageErrors': [], 'consoleErrors': [], 'requestErrors': [], 'pass': False}
                        report['rows'].append(row); save(); context = None
                        try:
                            context, page, fixture = start(browser, site, level, quality, row)
                            native = picture(row, 'native', page.evaluate('()=>window.__SURFACE_PROOF__.render()'))
                            row['originalActorShadowCoverage'] = page.evaluate('()=>window.__SURFACE_PROOF__.actorCoverage()')
                            if level == 31: row['flatWallSurface'] = page.evaluate('()=>window.__SURFACE_PROOF__.wallSurface()')
                            assert native['state']['state'] == 'playing' and native['state']['steps'] == 2
                            light = native['lighting']
                            assert light['rendererEnabled'] and light['castShadow'] and light['visibleCasters'] > 0 and light['visibleReceivers'] > 0
                            assert light['mapSize'] == ([1024, 1024] if quality == 'balanced' else [2048, 2048])
                            if version == 'after':
                                policy = light['policy']
                                assert policy and policy['revision'] == 'room-fitted-observatory-shadow-v1'
                                assert policy['camera'] == light['frustum'] and policy['normalBias'] == light['normalBias'] and policy['bias'] == light['bias']
                                assert policy['mapSize'] == light['mapSize'], 'Current quality did not refresh the authored shadow policy'
                                assert policy['receiverPolicy'] == 'vertical-service-bay-only' and policy['receiverMaterialCount'] > 0 and policy['receiverMeshCount'] > 0
                                assert policy['wallNormalBias'] >= policy['normalBias'] and abs(policy['wallNormalExtra']-(policy['wallNormalBias']-policy['normalBias'])) < 1e-12
                            else: assert light['policy'] is None, 'Baseline unexpectedly contains the new policy'
                            assert all(math.isfinite(v) for v in light['frustum'].values())
                            assert light['frustum']['far'] > light['frustum']['near'] > 0
                            if level == 31 and DIAGNOSTICS: controls(page, row)
                            restored = picture(row, 'restored-native', page.evaluate('()=>window.__SURFACE_PROOF__.render()'))
                            assert restored['state'] == native['state'] and restored['lighting'] == native['lighting']
                            assert restored['sha256'] == native['sha256'], 'Diagnostic changes leaked into the final native image'
                            if level == 31 and DIAGNOSTICS:
                                contact_control(page, row)
                                look_row = {'version': version+'-look', 'level': level, 'quality': quality,
                                            'inspection': 'ordinary-look-down', 'scope': 'Same original cargo and unchanged shadow policy; only an ordinary pitch input and 36 complete simulation/visual frames expose the real support floor.'}
                                row['lookInspection'] = look_row
                                contact_control(page, look_row, look=True)
                            assert page.evaluate('window.__NESI_PREFS__.value.completed') == fixture['completed']
                            assert not row['pageErrors'] and not row['consoleErrors'] and not row['requestErrors']
                            row['pass'] = True; print('PASS', version, level, quality, flush=True)
                        except Exception as e:
                            row['failure'] = str(e); print('FAIL', version, level, quality, str(e), flush=True)
                        finally:
                            row['wallSeconds'] = time.monotonic() - row_started
                            save()
                            if context: context.close()
        finally: browser.close()
    for before in [r for r in report['rows'] if r['version'] == 'before' and r['pass']]:
        after = next((r for r in report['rows'] if r['version'] == 'after' and r['level'] == before['level'] and r['quality'] == before['quality'] and r['pass']), None)
        if after:
            assert before['captures']['native']['state'] == after['captures']['native']['state'], 'Matched native cameras/actors differ between builds'
            old_light = before['captures']['native']['lighting']; new_light = after['captures']['native']['lighting']
            for key in ['position', 'target', 'intensity', 'color', 'normalBias']:
                assert old_light[key] == new_light[key], 'The wall fix changed the authored light or global actor/floor receiver offset'
            old_world_bias = old_light['bias'] * (old_light['frustum']['far']-old_light['frustum']['near'])
            new_world_bias = new_light['bias'] * (new_light['frustum']['far']-new_light['frustum']['near'])
            assert abs(old_world_bias-new_world_bias) < 1e-12, 'Global receiver depth offset changed in world units'
            for old, new in zip(before['originalActorShadowCoverage'], after['originalActorShadowCoverage']):
                assert old['name'] == new['name'] and old['vertices'] == new['vertices']
                assert new['outsideXY'] <= old['outsideXY'] and new['beyondFar'] <= old['beyondFar'] and new['behindNear'] == old['behindNear'], 'New shadow coverage regression for the original actors'
            if before['level'] == 31:
                old_rms = before['captures']['native']['flatWallRoi']['highPassRms']; new_rms = after['captures']['native']['flatWallRoi']['highPassRms']
                assert new_rms <= max(.25, old_rms*.6), 'Declared flat-wall ripple did not improve'
                if DIAGNOSTICS:
                    old = before['contactMetrics']; new = after['contactMetrics']
                    assert new['floorShadowPixels'] >= max(1, old['floorShadowPixels']*.2), 'Cargo shadow was erased in the native view'
                    assert before['captures']['grounded-contact']['state'] == after['captures']['grounded-contact']['state'], 'Contact comparison used different late actor/camera poses'
                    assert new['nearestFootprintGapPixels'] <= max(5, old['nearestFootprintGapPixels']+3), 'Cargo shadow detached farther from its footprint'
                    old_view = before['lookInspection']; new_view = after['lookInspection']; old = old_view['contactMetrics']; new = new_view['contactMetrics']
                    assert old_view['contact']['input'] == new_view['contact']['input'] and old_view['captures']['grounded-contact']['state'] == new_view['captures']['grounded-contact']['state'], 'Look inspection used different ordinary input or actor/camera poses'
                    assert new['floorShadowPixels'] >= max(12, old['floorShadowPixels']*.2), 'Cargo shadow was erased in the exposed support view'
                    assert new['nearestFootprintGapPixels'] <= max(5, old['nearestFootprintGapPixels']+3), 'Cargo shadow detached in the exposed support view'
                report.setdefault('pairedSurfaceAcceptance', []).append({'level': 31, 'quality': before['quality'], 'baselineRms': old_rms, 'candidateRms': new_rms, 'pass': True})
    expected = {(version, level, quality) for version in sites for level in LEVELS for quality in QUALITIES}
    observed = [(r['version'], r['level'], r['quality']) for r in report['rows']]
    assert len(observed) == len(expected) and set(observed) == expected, 'Missing or duplicate requested surface case'
    report['requestedCases'] = len(expected)
    report['pass'] = bool(report['rows']) and all(r['pass'] for r in report['rows'])
finally:
    report['wallSeconds'] = time.monotonic() - STARTED
    save()
    for site in sites.values(): site.close()
if not report['pass']: raise SystemExit(1)
