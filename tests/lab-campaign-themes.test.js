import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CAMPAIGN_THEMES,campaignTheme} from '../src/game/LabCampaignThemes.js';
import {FOUNDATION_SEQUENCE} from '../src/game/LabCampaignSequence.js';
import {finishCampaignTheme} from '../src/game/LabCampaignThemeFinish.js';

test('Five exact ten-room themes precede the separate castle finale without changing save indices',()=>{
 assert.equal(CAMPAIGN_THEMES.length,6);
 assert.deepEqual(CAMPAIGN_THEMES.map(t=>t.to-t.from+1),[10,10,10,10,10,1]);
 FOUNDATION_SEQUENCE.forEach((index,position)=>assert.equal(campaignTheme(index).id,CAMPAIGN_THEMES[Math.min(5,Math.floor(position/10))].id));
 assert.equal(campaignTheme(40).id,'castle');
 for(let index=41;index<=50;index++)assert.equal(campaignTheme(index).id,'fracture');
 for(const invalid of [-1,51,1.1,NaN,'1'])assert.throws(()=>campaignTheme(invalid),RangeError);
 assert.equal(new Set(CAMPAIGN_THEMES.map(t=>t.wall)).size,6);
 assert.equal(new Set(CAMPAIGN_THEMES.map(t=>t.floor)).size,6);
});
function fixture(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);scene.fog=new THREE.Fog(0xffffff,50,100);
 const floor=new THREE.MeshStandardMaterial({name:'Honed mineral walking deck',color:0xabcdef});
 const portal=new THREE.MeshStandardMaterial({name:'Portal porcelain',color:0xfffefe});
 const actor=new THREE.MeshStandardMaterial({name:'Satin enamel / machine family',color:0x345678});
 const signal=new THREE.MeshStandardMaterial({name:'Inset signal diffuser',color:0xf12345});
 const root=new THREE.Group(),asset=new THREE.Group();scene.add(root);
 const geometry=new THREE.BoxGeometry(2,1,2);for(const material of [floor,portal,actor,signal])root.add(new THREE.Mesh(geometry,material));
 asset.add(new THREE.Mesh(geometry,actor));
 const game={scene,chamberEdition:'foundation',assets:new Map([[1,asset]]),materials:{floor}};
 const level={world:{materials:{floor}},dispose(){this.disposed=true;}};
 return{game,level,root,floor,portal,actor,signal};
}
test('Theme copies architecture without recoloring original actors, signals, portal surfaces or shared source materials',()=>{
 const f=fixture(),before=f.root.children.map(o=>o.matrix.toArray());
 finishCampaignTheme(f.game,f.level,10,[f.root]);
 assert.equal(f.floor.color.getHex(),0xabcdef);
 assert.notEqual(f.root.children[0].material,f.floor);
 assert.equal(f.root.children[0].material.color.getHex(),campaignTheme(10).floor);
 for(const [i,key]of [[1,'portal'],[2,'actor'],[3,'signal']])assert.equal(f.root.children[i].material,f[key]);
 assert.deepEqual(f.root.children.map(o=>o.matrix.toArray()),before);
 assert.equal(f.level.campaignTheme.id,'dynamo');
 assert.equal(f.level.campaignTheme.changedMaterials,1);
 const copy=f.root.children[0].material;let disposed=0;copy.addEventListener('dispose',()=>disposed++);f.level.dispose();
 assert.equal(disposed,1);assert.equal(f.level.disposed,true);
});
test('Classic and open editions do not inherit foundation theme or metadata',()=>{
 for(const edition of ['classic','open']){
  const f=fixture();f.game.chamberEdition=edition;
  assert.equal(finishCampaignTheme(f.game,f.level,0,[f.root]),f.level);
  assert.equal(f.root.children[0].material,f.floor);assert.equal(f.level.campaignTheme,undefined);
 }
});
test('Castle theme preserves independently colored wing navigation accents',()=>{
 const f=fixture(),wing=new THREE.MeshStandardMaterial({name:'castle wing enamel / freight',color:0x446677});f.root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),wing));
 finishCampaignTheme(f.game,f.level,40,[f.root]);assert.equal(f.root.children.at(-1).material,wing);assert.equal(wing.color.getHex(),0x446677);
});

test('Castle theme retains the authored mineral walls and floor inlays of each wing',()=>{
 const f=fixture();f.level.tower=true;
 const originals=['Castle wing wall / freight','Castle cast-in floor / freight','Castle wing wall / optics','Castle cast-in floor / optics']
  .map((name,index)=>new THREE.MeshStandardMaterial({name,color:[0xd5cbb1,0xe4ded0,0xb3cbdd,0xdce4ec][index]}));
 const meshes=originals.map(material=>new THREE.Mesh(new THREE.BoxGeometry(2,2,.5),material));f.root.add(...meshes);
 finishCampaignTheme(f.game,f.level,40,[f.root]);
 meshes.forEach((mesh,index)=>assert.equal(mesh.material,originals[index],'common tint erased a wing finish'));
 f.level.dispose();
});

test('Castle common gallery floor and recessed soffit retain separate mineral values without recoloring unclassified machine metal',()=>{
 const f=fixture();f.level.tower=true;
 const floor=new THREE.MeshStandardMaterial({color:0xe5e0d3});floor.map=new THREE.Texture();floor.map.name='Castle floor / quiet mipmapped finish';
 const deck=new THREE.Mesh(new THREE.BoxGeometry(8,.4,8),floor);deck.name='Unioned floors / no coincident tops';f.root.add(deck);
 const metal=new THREE.MeshStandardMaterial({color:0xe5e0d3}),machine=new THREE.Mesh(new THREE.BoxGeometry(1,4,1),metal);f.root.add(machine);
 const soffit=new THREE.MeshStandardMaterial({name:'Castle recessed roof soffit',color:0x415363}),roof=new THREE.Mesh(new THREE.BoxGeometry(10,.5,10),soffit);f.root.add(roof);
 finishCampaignTheme(f.game,f.level,40,[f.root]);const theme=campaignTheme(40);
 assert.equal(deck.material.color.getHex(),theme.floor);assert.notEqual(deck.material,floor);
 assert.equal(roof.material.color.getHex(),theme.dark);assert.notEqual(roof.material,soffit);
 assert.equal(machine.material,metal);assert.equal(metal.color.getHex(),0xe5e0d3);
 assert.equal(floor.color.getHex(),0xe5e0d3);assert.equal(soffit.color.getHex(),0x415363);f.level.dispose();
});

test('Instanced architectural skin receives the same chapter palette without changing placement or portal instances',()=>{
 const f=fixture();const geo=new THREE.BoxGeometry(1,1,.08),mat=new THREE.MeshStandardMaterial({color:0xffffff});
 const skin=new THREE.InstancedMesh(geo,mat,4);skin.name='Architectural coat / cassette';
 const normal=new THREE.Vector3(0,0,1),directions=[[0,0,1],[1,0,0],[0,1,0],[0,-1,0]];
 directions.forEach((p,i)=>{skin.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(i*3,0,0),new THREE.Quaternion().setFromUnitVectors(normal,new THREE.Vector3(...p)),new THREE.Vector3(2,2,1)));skin.setColorAt(i,new THREE.Color(0x123456));});
 const before=Array.from(skin.instanceMatrix.array);f.root.add(skin);
 const portalSkin=skin.clone();portalSkin.name='Portal tiles';portalSkin.instanceColor=skin.instanceColor.clone();f.root.add(portalSkin);const portalColors=Array.from(portalSkin.instanceColor.array);
 finishCampaignTheme(f.game,f.level,20,[f.root]);const theme=campaignTheme(20),c=new THREE.Color();
 for(const [i,role]of ['wall','paint','floor','shell'].entries()){skin.getColorAt(i,c);assert.equal(c.getHex(),theme[role]);}
 assert.deepEqual(Array.from(skin.instanceMatrix.array),before);assert.deepEqual(Array.from(portalSkin.instanceColor.array),portalColors);
 assert.equal(f.level.campaignTheme.architecturalInstances,4);assert.equal(skin.material,mat);
});
