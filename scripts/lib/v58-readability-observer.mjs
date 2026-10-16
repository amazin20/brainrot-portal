/** Read-only geometric pixel sampling of the ordinary, already rendered lens.
 * This is not a GPU segmentation pass. Original scene, materials, skin caches,
 * camera and physics are never advanced or edited by this observer. */
export function createReadabilityObserver(THREE,game,{roles,maxSamplesPerRole=25}={}){
 const fail=m=>{throw Error('Readability observer: '+m);},check=(v,m)=>{if(!v)fail(m);};
 const finite=(v,m)=>{check(Number.isFinite(v),m+' nonfinite');return v;};
 const tuple=(v,m)=>{const a=v.toArray();a.forEach(n=>finite(n,m));return a;};
 const integer=(v,m,min=0)=>check(Number.isSafeInteger(v)&&v>=min,m);
 integer(maxSamplesPerRole,'sample budget',1);check(maxSamplesPerRole<=25,'at most25 rays per role');
 check(Array.isArray(roles)&&roles.length>0&&roles.length<=16,'bounded actual target roles');
 const seen=new Set(),specs=roles.map(r=>{check(typeof r.role==='string'&&r.role&&!seen.has(r.role),'unique role');seen.add(r.role);
  check(Array.isArray(r.roots)&&r.roots.length>0&&r.roots.every(n=>n?.isObject3D),'actual Object3D roots');
  for(const k of ['bodyId','shapeId'])if(r[k]!==undefined)integer(r[k],k);
  return {role:r.role,roots:r.roots.slice(),...(r.bodyId!==undefined?{bodyId:r.bodyId}:{}),...(r.shapeId!==undefined?{shapeId:r.shapeId}:{})};});
 const refs={scene:game.scene,camera:game.camera,renderer:game.renderer,world:game.physics?.world};
 check(refs.scene?.isScene&&refs.camera?.isPerspectiveCamera&&refs.renderer&&refs.world,'actual scene/lens/renderer/world');
 const MAX_MESHES=12000,MAX_VERTICES=3_000_000,MAX_TRIANGLES=2_000_000,MAX_GRID_TESTS=2_000_000;
 let previous=null;
 const materialList=m=>Array.isArray(m)?m:[m];
 const insideHierarchy=n=>{for(let p=n;p;p=p.parent)if(p.visible===false)return false;return true;};
 const belongs=(n,roots)=>{for(let p=n;p;p=p.parent)if(roots.includes(p))return true;return false;};
 const materialFor=h=>Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
 function reason(material,source){
  if(source.userData?.portalRenderResource||game.portals?.portals?.some(p=>p?.surface===source))return 'portal-render-surface';
  if(material.isShaderMaterial||material.isRawShaderMaterial)return 'custom-shader';
  if(material.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return 'custom-shader-callback';
  if(material.transparent||material.opacity<1||material.transmission>0)return 'transparent-or-transmissive';
  if(material.alphaTest>0||material.alphaHash||material.alphaToCoverage||material.alphaMap)return 'alpha-discard';
  if(material.clippingPlanes?.length)return 'material-clipping';
  if(material.displacementMap)return 'shader-displacement';
  if(material.depthTest===false||material.depthWrite===false||material.colorWrite===false)return 'unsupported-depth-or-color-write';
  if(material.wireframe)return 'wireframe';
  return null;
 }
 function rawState(){
  const values=[game.scene,game.camera,game.renderer,game.physics?.world,game.state,game.yaw,game.pitch,
   refs.world.stepnumber,refs.renderer.info?.render?.frame,refs.camera.fov,refs.camera.aspect,refs.camera.near,refs.camera.far];
  const add=v=>{if(v?.toArray)values.push(...v.toArray());};
  for(const k of ['position','quaternion','scale','up','matrix','matrixWorld','matrixWorldInverse','projectionMatrix','projectionMatrixInverse'])add(refs.camera[k]);
  add(game.playerPosition);add(game.playerVelocity);values.push(game.playerGrounded);
  const planes=game.cameraRig?.mainClippingPlanes??[];values.push(planes,planes.length);for(const p of planes){values.push(p,p.constant);add(p.normal);}
  let count=0;refs.scene.traverse(n=>{check(++count<=MAX_MESHES*4,'scene node budget');values.push(n,n.parent,n.visible,n.layers.mask,n.children.length,...n.children);add(n.position);add(n.quaternion);add(n.scale);add(n.matrix);add(n.matrixWorld);
   if(n.isMesh){values.push(n.geometry,n.geometry.boundingBox,n.geometry.boundingSphere,n.material);
    for(const m of materialList(n.material))if(m)values.push(m,m.visible,m.side,m.transparent,m.opacity,m.alphaTest,m.depthWrite,m.depthTest,m.colorWrite,m.clippingPlanes,m.onBeforeCompile);
    if(n.skeleton){values.push(n.skeleton,n.skeleton.boneMatrices);if(n.skeleton.boneMatrices)values.push(...n.skeleton.boneMatrices);}
   }});
  values.push(refs.world.bodies?.length??0);for(const b of refs.world.bodies??[]){values.push(b,b.id,b.type,b.mass);for(const k of ['position','quaternion','velocity','angularVelocity','force','torque'])add(b[k]);}
  return values;
 }
 function same(a,b){check(a.length===b.length&&a.every((v,i)=>Object.is(v,b[i])),'read purity or clock drift');}
 function prepared(mesh){
  for(let n=mesh;n;n=n.parent){const m=new THREE.Matrix4().compose(n.position,n.quaternion,n.scale);check(m.elements.every((v,i)=>Math.abs(v-n.matrix.elements[i])<1e-7),'stale local matrix');
   if(n.parent){m.multiplyMatrices(n.parent.matrixWorld,n.matrix);check(m.elements.every((v,i)=>Math.abs(v-n.matrixWorld.elements[i])<1e-6),'stale world matrix');}}
  if(mesh.skeleton){const s=mesh.skeleton;check(s.boneMatrices?.length>=s.bones.length*16,'missing prepared skin cache');
   for(let i=0;i<s.bones.length;i++){const m=new THREE.Matrix4().multiplyMatrices(s.bones[i].matrixWorld,s.boneInverses[i]);check(m.elements.every((v,j)=>Number.isFinite(v)&&Math.abs(v-s.boneMatrices[i*16+j])<3e-4),'stale prepared skin cache');}}
 }
 function queries(){
  const entries=[];let vertices=0,triangles=0;
  refs.scene.traverse(n=>{
   if((n.isSprite||n.isPoints||n.isLine)&&insideHierarchy(n)&&n.layers.test(refs.camera.layers))fail('unsupported non-mesh renderable');
   if(!n.isMesh||!insideHierarchy(n)||!n.layers.test(refs.camera.layers))return;
   const materials=materialList(n.material);if(!materials.some(m=>m&&m.visible!==false))return;
   check(entries.length<MAX_MESHES,'query mesh budget');prepared(n);
   const original=n.geometry,position=original?.attributes?.position;check(position&&position.itemSize===3,'actual position geometry');
   check(!n.isInstancedMesh||!n.morphTexture,'unsupported instanced morph geometry');
   if(original.index)for(let i=0;i<original.index.count;i++){const value=original.index.getX(i);check(Number.isSafeInteger(value)&&value>=0&&value<position.count,'invalid actual triangle index');}
   vertices+=position.count;check(vertices<=MAX_VERTICES,'query vertex budget');
   const array=new Float64Array(position.count*3),v=new THREE.Vector3();
   for(let i=0;i<position.count;i++){n.getVertexPosition(i,v);for(const [j,value]of v.toArray().entries())array[i*3+j]=finite(value,'actual vertex');}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(array,3));
   if(original.index)geometry.setIndex(original.index);for(const group of original.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
   geometry.setDrawRange(original.drawRange.start,original.drawRange.count);geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const instances=n.isInstancedMesh?n.count:1;integer(instances,'instance count');check(instances<=MAX_MESHES,'instance budget');
   triangles+=Math.floor((original.index?.count??position.count)/3)*instances;check(triangles<=MAX_TRIANGLES,'query triangle budget');
   for(let instance=0;instance<instances;instance++){
    check(entries.length<MAX_MESHES,'query instance budget');const query=new THREE.Mesh(geometry,n.material);query.matrixAutoUpdate=false;query.matrixWorld.copy(n.matrixWorld);
    if(n.isInstancedMesh){const transform=new THREE.Matrix4();n.getMatrixAt(instance,transform);query.matrixWorld.multiply(transform);}
    query.matrixWorld.elements.forEach(x=>finite(x,'query world matrix'));query.layers.mask=n.layers.mask;
    entries.push({source:n,instanceId:n.isInstancedMesh?instance:null,query,geometry});
   }
  });return entries;
 }
 const clipPlanes=[v=>v.w+v.x,v=>v.w-v.x,v=>v.w+v.y,v=>v.w-v.y,v=>v.w+v.z,v=>v.w-v.z,v=>v.w-1e-9];
 function clip(points){
  for(const distance of clipPlanes){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=distance(a),db=distance(b),ia=da>=0,ib=db>=0;
    if(ia)out.push(a);if(ia!==ib)out.push(a.clone().lerp(b,da/(da-db)));}points=out;if(points.length<3)return [];}
  return points;
 }
 function footprint(entries,width,height){
  const polygons=[],bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  const viewProjection=new THREE.Matrix4().multiplyMatrices(refs.camera.projectionMatrix,refs.camera.matrixWorldInverse);
  for(const entry of entries){const geometry=entry.geometry,index=geometry.index,position=geometry.attributes.position,total=index?.count??position.count;
   const groups=Array.isArray(entry.query.material)?geometry.groups:[{start:0,count:total,materialIndex:0}];
   const start=geometry.drawRange.start,end=Math.min(total,start+geometry.drawRange.count);
   const transform=new THREE.Matrix4().multiplyMatrices(viewProjection,entry.query.matrixWorld);
   for(const group of groups){const material=materialList(entry.query.material)[group.materialIndex];if(!material||material.visible===false)continue;
    for(let i=Math.max(start,group.start);i+2<Math.min(end,group.start+group.count);i+=3){const p=[];
     for(let j=0;j<3;j++){const vertex=index?index.getX(i+j):i+j;p.push(new THREE.Vector4(position.getX(vertex),position.getY(vertex),position.getZ(vertex),1).applyMatrix4(transform));}
     const clipped=clip(p);if(clipped.length<3)continue;const screen=clipped.map(v=>[(v.x/v.w+1)*width/2,(1-v.y/v.w)*height/2]);
     for(let j=1;j<screen.length-1;j++){const triangle=[screen[0],screen[j],screen[j+1]],area=(triangle[1][0]-triangle[0][0])*(triangle[2][1]-triangle[0][1])-(triangle[1][1]-triangle[0][1])*(triangle[2][0]-triangle[0][0]);if(Math.abs(area)<1e-9)continue;
      polygons.push(triangle);for(const [x,y]of triangle){finite(x,'projected x');finite(y,'projected y');bounds.minX=Math.min(bounds.minX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxX=Math.max(bounds.maxX,x);bounds.maxY=Math.max(bounds.maxY,y);}}
    }
   }
  }
  if(!polygons.length)return {bbox:null,step:1,cells:[]};
  const step=Math.max(1,Math.ceil(Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY)/48)),cells=new Map();let tests=0;
  const edge=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
  for(const t of polygons){const minX=Math.max(0,Math.ceil((Math.min(...t.map(p=>p[0]))-.5)/step)),maxX=Math.min(Math.floor((width-.5)/step),Math.floor((Math.max(...t.map(p=>p[0]))-.5)/step));
   const minY=Math.max(0,Math.ceil((Math.min(...t.map(p=>p[1]))-.5)/step)),maxY=Math.min(Math.floor((height-.5)/step),Math.floor((Math.max(...t.map(p=>p[1]))-.5)/step));
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){check(++tests<=MAX_GRID_TESTS,'projected grid work budget');const px=x*step+.5,py=y*step+.5,e=t.map((p,i)=>edge(p,t[(i+1)%3],px,py));if(e.every(n=>n>=-1e-8)||e.every(n=>n<=1e-8))cells.set(y+':'+x,[px,py]);}}
  return {bbox:{...bounds,width:bounds.maxX-bounds.minX,height:bounds.maxY-bounds.minY},step,cells:[...cells.values()].sort((a,b)=>a[1]-b[1]||a[0]-b[0])};
 }
 function intersections(entries,raycaster){
  const hits=[];for(const entry of entries){const found=[];entry.query.raycast(raycaster,found);for(const h of found){const material=materialFor(h);if(!material||material.visible===false)continue;
    const depth=-h.point.clone().applyMatrix4(refs.camera.matrixWorldInverse).z;if(!(depth>=refs.camera.near&&depth<=refs.camera.far))continue;
    finite(h.distance,'hit distance');hits.push({...h,entry,material,depth});}}
  return hits.sort((a,b)=>a.distance-b.distance||a.entry.source.uuid.localeCompare(b.entry.source.uuid)||(a.entry.instanceId??-1)-(b.entry.instanceId??-1));
 }
 const record=h=>h?{meshUUID:h.entry.source.uuid,instanceId:h.entry.instanceId,faceIndex:h.faceIndex,materialIndex:h.face?.materialIndex??0,distance:h.distance,worldPoint:h.point.toArray(),cameraDepth:h.depth}:null;
 return {observe({encodedFrame,visualFrame,worldStep}){
  integer(encodedFrame,'encodedFrame');integer(visualFrame,'visualFrame');integer(worldStep,'worldStep');
  check(game.scene===refs.scene&&game.camera===refs.camera&&game.renderer===refs.renderer&&game.physics?.world===refs.world,'original scene/lens/physics replaced');
  check(worldStep===refs.world.stepnumber,'capture world clock drift');const renderFrame=refs.renderer.info?.render?.frame;integer(renderFrame,'actual rendered frame',1);
  if(previous)check(encodedFrame>previous.encodedFrame&&visualFrame>previous.visualFrame&&worldStep>=previous.worldStep&&renderFrame>previous.renderFrame,'capture/render clock not increasing');
  const before=rawState(),canvas=refs.renderer.domElement,width=canvas?.width,height=canvas?.height;
  integer(width,'drawing buffer width',1);integer(height,'drawing buffer height',1);check(width<=4096&&height<=4096,'drawing buffer budget');
  prepared(refs.camera);for(const matrix of [refs.camera.matrixWorld,refs.camera.matrixWorldInverse,refs.camera.projectionMatrix,refs.camera.projectionMatrixInverse])matrix.elements.forEach(x=>finite(x,'actual camera matrix'));
  const lens=refs.camera;check(lens.fov>0&&lens.fov<=120&&lens.aspect>0&&lens.near>0&&lens.far>lens.near&&lens.zoom===1&&!lens.view&&lens.filmOffset===0,'unsupported ordinary perspective lens');
  const tangent=Math.tan(lens.fov*Math.PI/360),projection=lens.projectionMatrix.elements;
  check(Math.abs(projection[0]-1/(tangent*lens.aspect))<1e-6&&Math.abs(projection[5]-1/tangent)<1e-6&&Math.abs(projection[10]+(lens.far+lens.near)/(lens.far-lens.near))<1e-6&&Math.abs(projection[14]+2*lens.far*lens.near/(lens.far-lens.near))<1e-6&&projection[8]===0&&projection[9]===0&&projection[11]===-1&&projection[15]===0,'lens properties contradict actual projection');
  for(const [a,b]of [[refs.camera.matrixWorld,refs.camera.matrixWorldInverse],[refs.camera.projectionMatrix,refs.camera.projectionMatrixInverse]]){const m=new THREE.Matrix4().multiplyMatrices(a,b);check(m.elements.every((v,i)=>Math.abs(v-(i%5===0?1:0))<1e-6),'stale camera inverse');}
  const camera={position:tuple(refs.camera.position,'eye'),quaternion:tuple(refs.camera.quaternion,'camera quaternion'),fov:finite(refs.camera.fov,'fov'),aspect:finite(refs.camera.aspect,'aspect'),near:refs.camera.near,far:refs.camera.far,
   matrixWorld:tuple(refs.camera.matrixWorld,'camera matrix'),matrixWorldInverse:tuple(refs.camera.matrixWorldInverse,'view matrix'),projectionMatrix:tuple(refs.camera.projectionMatrix,'projection'),projectionMatrixInverse:tuple(refs.camera.projectionMatrixInverse,'inverse projection'),canvas:{width,height},mainClippingPlanes:(game.cameraRig?.mainClippingPlanes??[]).map(p=>[...tuple(p.normal,'clip normal'),p.constant])};
  const entries=queries(),raycaster=new THREE.Raycaster();raycaster.layers.mask=refs.camera.layers.mask;const unsupported=camera.mainClippingPlanes.length>0;
  const output=specs.map(spec=>{const targets=entries.filter(e=>belongs(e.source,spec.roots)),targetMeshUUIDs=[...new Set(targets.map(e=>e.source.uuid))].sort(),projected=footprint(targets,width,height),samples=[],reasons=new Set();
   if(unsupported)reasons.add('main-clipping');const count=Math.min(maxSamplesPerRole,projected.cells.length);
   for(let i=0;i<count;i++){const pixel=projected.cells[Math.floor((i+.5)*projected.cells.length/count)],ndc=[pixel[0]/width*2-1,1-pixel[1]/height*2];raycaster.setFromCamera(new THREE.Vector2(...ndc),refs.camera);
    const hits=intersections(entries,raycaster),target=hits.find(h=>targets.includes(h.entry));if(!target)continue;
    const first=hits[0]??null,why=[];if(unsupported)why.push('main-clipping');
    if(first){const r=reason(first.material,first.entry.source);if(r)why.push(r);}
    if(hits.some(h=>h.material.depthTest===false))why.push('depth-test-overlay');
    const sameTarget=Boolean(first&&first.entry===target.entry&&Math.abs(first.distance-target.distance)<1e-6),uncertain=why.length>0;
    for(const r of why)reasons.add(r);samples.push({pixel,ndc,target:record(target),firstHit:record(first),firstHitIsTarget:sameTarget&&!uncertain,uncertain,reasons:[...new Set(why)]});
   }
   const visible=samples.filter(s=>s.firstHitIsTarget).length;
   return {role:spec.role,...(spec.bodyId!==undefined?{bodyId:spec.bodyId}:{}),...(spec.shapeId!==undefined?{shapeId:spec.shapeId}:{}),targetMeshUUIDs,bboxPixels:projected.bbox,gridStepPixels:projected.step,
    projectedFootprintPixelsEstimate:projected.cells.length*projected.step**2,projectedSamples:samples.length,firstHitTargetSamples:visible,visibleFraction:samples.length?visible/samples.length:0,samples,
    uncertain:{frameUnsupported:unsupported,samples:samples.filter(s=>s.uncertain).length,reasons:[...reasons].sort()}};
  });
  same(before,rawState());previous={encodedFrame,visualFrame,worldStep,renderFrame};
  return {clock:{...previous},camera,roles:output,readPurity:{unchanged:true,noRender:true,noPhysicsStep:true,noLensOrSceneWrites:true},scope:'Deterministic actual-triangle clipped pixel-grid first-hit geometric sampling; paired native pixels are required; not GPU segmentation or exhaustive visibility.'};
 }};
}
