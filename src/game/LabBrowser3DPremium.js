import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ArchitecturalBatch,architecturalMaterials,architecturalCassetteGeometry,clipArchitecturalRect} from './LabArchitecturalModels.js';
import {advancedRoomPalette} from './LabAdvancedArchitecture.js';
import {earlyRoomPalette,architecturalCeiling} from './LabEarlyArchitecture.js';
import {getChapterVisualProfile,chapterSurfaceColor,keepsAuthoredMaterial} from './LabChapterArt.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Z=V(0,0,1);

function portalFrames(level){
  const surfaces=new Set([...Object.values(level.panels||{}),...level.world.surfaces.filter(s=>s.portal)]);
  return [...surfaces].filter(s=>s?.getFrame).map(s=>s.getFrame());
}

function frameFromMatrix(matrix){
  return {center:V().setFromMatrixPosition(matrix),right:V(1,0,0).transformDirection(matrix),up:V(0,1,0).transformDirection(matrix),normal:Z.clone().transformDirection(matrix)};
}

/** The shell has a few architectural scales: full-height bays, folded metal
 * cassettes, then occasional service hatches. Fine details never become extra
 * gameplay objects. All front faces stay within 20 mm of the existing plane. */
function addArchitecturalCladding(level,root){
  const w=level.world,g=level.game,profile=getChapterVisualProfile(level),materials=architecturalMaterials(profile?.edge??level.spec?.accent);
  if(profile){materials.frame.color.setHex(profile.trim);materials.recess.color.setHex(profile.trim);materials.coat.roughness=.62;materials.coat.metalness=.035;}
  const batch=new ArchitecturalBatch(root,materials);
  const singleSkin=level.index>=23;
  if(singleSkin){
    batch.geometry.dispose();
    batch.geometry=architecturalCassetteGeometry({corner:.006,inset:.004});
    // One closed mesh owns the visible surface. The dark folded shoulder is
    // vertex colour, not a second plane four millimetres behind the paint.
    const position=batch.geometry.attributes.position,colors=[];
    for(let i=0;i<position.count;i++){const value=position.getZ(i)>.49?1:.56;colors.push(value,value,value);}
    batch.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    materials.coat.vertexColors=true;materials.coat.roughnessMap=null;
  }
  w.root.updateWorldMatrix(true,true);
  const inverse=w.root.matrixWorld.clone().invert(),portals=portalFrames(level);
  const palette=profile??(level.index<11?earlyRoomPalette(level.index):level.index>=15?advancedRoomPalette(level.index):null);
  const tone=(color,cadence)=>new THREE.Color(color).multiplyScalar(cadence===0?.94:1).getHex();
  let instances=0,sourceBoxes=0,sourceSurfaces=0,serviceBands=0,ventPanels=0;
  const coverage=[];
  const face=(matrix,width,height,{kind='wall',solid=false,seed=0,role}={})=>{
    const frame=frameFromMatrix(matrix),local=inverse.clone().multiply(matrix);
    const floor=kind==='floor',ceiling=kind==='ceiling';
    const cols=Math.max(1,Math.ceil(width/(profile?(floor?6.5:8):floor?3.25:ceiling?5.4:4.8)));
    const rows=Math.max(1,Math.ceil(height/(profile?(floor?6.5:6):floor?3.25:ceiling?5.4:3.2)));
    const cw=width/cols,ch=height/rows;
    // Solids already have their own opaque front; stand the finish 8 mm out.
    // Tiled surfaces have a recessed backing and the replacement ends 4 mm
    // behind the collision plane, including stairs and walking decks.
    const front=solid?.008:-.004;
    for(let ix=0;ix<cols;ix++)for(let iy=0;iy<rows;iy++){
      const module={x0:-width/2+cw*ix,x1:-width/2+cw*(ix+1),y0:-height/2+ch*iy,y1:-height/2+ch*(iy+1)};
      const pieces=clipArchitecturalRect(module,frame,portals);
      for(const rect of pieces){
        const x=(rect.x0+rect.x1)/2,y=(rect.y0+rect.y1)/2,pw=rect.x1-rect.x0-.035,ph=rect.y1-rect.y0-.035;
        if(pw<.10||ph<.10)continue;
        const cadence=(ix+iy*3+seed)%7;
        const color=profile?chapterSurfaceColor(profile,{kind,frame,role}):palette?tone(floor?(frame.center.y>5?palette.high:palette.low):ceiling?palette.low:palette.wall,cadence):floor?(cadence===0?0x7b898b:0x879194):ceiling?(cadence===0?0x7c888b:0x909c9f):solid?(cadence===0?0x809093:0x75868a):(cadence===0?0x9aa5a5:0x89999d);
        if(!singleSkin)batch.add('frame',local,[x,y,front-.030],[pw,ph,.052]);
        // The folded lip is exposed around a slightly smaller coated field.
        const inset=Math.min(.085,pw*.1,ph*.1);
        if(singleSkin)batch.add('coat',local,[x,y,front-.040],[pw,ph,.080],{color});
        else batch.add('coat',local,[x,y,front-.008],[pw-inset*2,ph-inset*2,.016],{color});
        instances++;
        coverage.push({center:frame.center.clone().addScaledVector(frame.right,x).addScaledVector(frame.up,y).toArray(),right:frame.right.toArray(),up:frame.up.toArray(),normal:frame.normal.toArray(),halfWidth:pw/2,halfHeight:ph/2,front});
        const complete=pieces.length===1&&pw>2.2&&ph>1.5;
        if(!complete||floor||profile||singleSkin)continue;
        // Two stamped locks explain how each large wall cassette is mounted.
        for(const sx of [-1,1])batch.add('steel',local,[x+sx*(pw/2-.17),y+ph/2-.16,front+.002],[.036,.036,.008],{geometry:'bolt'});
        if(ceiling)continue;
        // Infrequent recessed ventilation cartridges have a dark well,
        // six actual louvers, a folded rim and a small removable end cap.
        if((ix+iy*2+seed)%6===1&&pw>2.8&&ph>2){
          const vw=Math.min(1.50,pw*.44),vh=.40,vy=y-ph/2+.43;
          batch.add('steel',local,[x,vy,front+.001],[vw+.075,vh+.08,.008]);
          batch.add('recess',local,[x,vy,front+.006],[vw,vh,.006]);
          for(let slat=0;slat<6;slat++)batch.add('frame',local,[x,vy-vh*.39+slat*vh*.156,front+.009],[vw-.065,.018,.006],{geometry:'box'});
          ventPanels++;
        }
        // Every third bay has an upper service shoulder. It belongs to the
        // panel, so clipping the panel also clips its integrated fixture.
        if(iy%3===2&&ix%2===0&&pw>3){
          const by=y+ph*.29,bw=Math.min(2.2,pw-.6);
          batch.add('recess',local,[x,by,front+.002],[bw,.19,.008]);
          batch.add('steel',local,[x,by-.044,front+.006],[bw-.10,.045,.007],{geometry:'box'});
          batch.add('lamp',local,[x,by+.025,front+.009],[bw-.18,.035,.005],{geometry:'box'});
          serviceBands++;
        }
      }
    }
  };

  for(const surface of w.surfaces){
    if(surface.portal||surface.collider?.kinematic||keepsAuthoredMaterial(surface.group)||surface.group.children.some(n=>n.isInstancedMesh&&keepsAuthoredMaterial(n)))continue;
    const f=surface.getFrame(),floor=f.normal.y>.9,ceiling=f.normal.y<-.9;
    // Keep narrow stair treads in the established authored kit; the material
    // treatment below still cleans them without another layer of geometry.
    if(!singleSkin&&floor&&Math.min(surface.width,surface.height)<.6)continue;
    surface.group.updateWorldMatrix(true,false);
    face(surface.group.matrixWorld,surface.width,surface.height,{kind:floor?'floor':ceiling?'ceiling':'wall',seed:sourceSurfaces++,role:surface.group.userData.chapterColorRole});
    // The old GLB stays available to the existing surface/asset contract, but
    // is not rendered under the cassette and does not double the triangles.
    for(const node of surface.group.children)if(node.isInstancedMesh&&!node.userData.portalTile&&!keepsAuthoredMaterial(node)){node.visible=false;node.userData.replacedByArchitecturalCassette=true;}
  }

  for(const collider of g.colliders){
    const mesh=collider.mesh,p=mesh?.geometry?.parameters;
    if(!mesh?.visible||mesh.userData?.collisionProxy||keepsAuthoredMaterial(mesh)||collider.kinematic||!p||![p.width,p.height,p.depth].every(Number.isFinite))continue;
    if(mesh.material!==w.materials.wall&&mesh.material!==w.materials.trim)continue;
    if(p.height<1.5||Math.max(p.width,p.depth)<2.5)continue;
    mesh.updateWorldMatrix(true,false);sourceBoxes++;
    if(singleSkin){
      // Finish the actual solid, not four paper-thin copies on top of it.
      // Physical dimensions, registry identities and ray targets are unchanged.
      const old=mesh.geometry;
      mesh.geometry=new RoundedBoxGeometry(p.width,p.height,p.depth,2,Math.min(.065,p.width*.12,p.height*.12,p.depth*.12));
      mesh.userData.singleSkinSolid=true;
      // The original geometry is retained for level ownership/cleanup.
      old.dispose();continue;
    }
    const sides=[
      {at:[0,0,p.depth/2],normal:[0,0,1],width:p.width},
      {at:[0,0,-p.depth/2],normal:[0,0,-1],width:p.width},
      {at:[p.width/2,0,0],normal:[1,0,0],width:p.depth},
      {at:[-p.width/2,0,0],normal:[-1,0,0],width:p.depth},
    ];
    for(const side of sides){
      if(side.width<.6)continue;
      const rotation=new THREE.Quaternion().setFromUnitVectors(Z,V(...side.normal));
      const matrix=mesh.matrixWorld.clone().multiply(new THREE.Matrix4().compose(V(...side.at),rotation,V(1,1,1)));
      face(matrix,side.width,p.height,{solid:true,seed:sourceBoxes,role:mesh.userData.chapterColorRole});
    }
  }
  root.userData.architecturalCoverage=coverage;
  return {instances,sourceBoxes,sourceSurfaces,serviceBands,ventPanels,...batch.finish()};
}

function finishMaterials(level){
  const w=level.world,m=w.root.userData.browserArtMaterials;
  const profile=getChapterVisualProfile(level),palette=profile??(level.index<11?earlyRoomPalette(level.index):level.index>=15?advancedRoomPalette(level.index):null);
  const finish=(mat,color,roughness,metalness)=>{
    if(!mat)return;mat.color?.setHex(color);mat.roughness=roughness;mat.metalness=metalness;
    if(mat.emissive){mat.emissive.setHex(0x000000);mat.emissiveIntensity=0;}
    // The original coarse scratches were normal noise at the gameplay camera.
    mat.bumpMap=null;mat.bumpScale=0;mat.roughnessMap=null;mat.needsUpdate=true;
  };
  finish(w.materials.wall,palette?.wall??0x65767c,.74,.08);
  finish(w.materials.floor,palette?.low??0x7b898d,.72,.10);
  finish(w.materials.trim,palette?.trim??0x4b6068,.66,.12);
  if(m){
    finish(m.graphite,palette?.wall??0x77868c,.66,.12);finish(m.steel,palette?.low??0x89979b,.48,.38);finish(m.blackSteel,palette?.trim??0x42555f,.62,.22);
    // White ceramic is the sole portal target color. Its canonical material
    // and every surface/frame remain intact; remove only the coarse bump.
    m.ceramic.bumpMap=null;m.ceramic.bumpScale=0;m.ceramic.roughnessMap=null;
    m.ceramic.roughness=.60;m.ceramic.metalness=.015;m.ceramic.needsUpdate=true;
  }
  level.game.scene.background=new THREE.Color(palette?.sky??0x354852);
  if(level.game.scene.fog)level.game.scene.fog.color.setHex(palette?.sky??0x354852);
}

function addLighting(level,root){
  // LabGame already owns the shadow key and a 2.5-strength hemisphere.
  // Stacking two more ambient lights and point lights flattened the model
  // relief, while costing another light evaluation in every portal pass.
  // A single restrained cool rim retains the broad diffuse material tones.
  const b=level.bounds||level.workshop?.bounds||{minX:-20,maxX:20,minZ:-20,maxZ:20};
  const ceiling=architecturalCeiling(level,24),cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
  const profile=getChapterVisualProfile(level);
  const fill=new THREE.DirectionalLight(profile?.fill??0xd8ecf5,.80);fill.name='Architectural edge fill';fill.position.set(cx+16,ceiling*.68,cz-12);fill.castShadow=false;
  const target=new THREE.Object3D();target.position.set(cx,ceiling*.24,cz);root.add(target);fill.target=target;root.add(fill);
  return {directionalLights:1,pointLights:0};
}

export function applyPremiumBrowser3DArt(level){
  if(!level?.world||level.index<0||level.index>29||level.premiumBrowser3DArt)return level;
  level.game=level.game||level.workshop?.game||level.world.game;
  finishMaterials(level);
  const root=new THREE.Group();root.name='Premium browser 3D environment layer';root.userData.visualOnly=true;root.userData.version=33;level.world.root.add(root);
  const cladding=addArchitecturalCladding(level,root),lighting=addLighting(level,root);
  root.userData.stats={...cladding,...lighting};level.premiumBrowser3DArt=root;
  return level;
}
