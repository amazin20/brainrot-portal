import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabGame} from '../src/game/LabGame.js';
import {Workshop} from '../src/game/LabWorkshopKit.js';
import {configureChapterWorld,CHAPTER_VISUAL_PROFILES,finishChapterArt} from '../src/game/LabChapterArt.js';
import {finishAdvancedRoom} from '../src/game/LabAdvancedArchitecture.js';
import {upgradeBrowser3DArt} from '../src/game/LabBrowser3DArt.js';
import {applyPremiumBrowser3DArt} from '../src/game/LabBrowser3DPremium.js';
import {applyMechanismReflections} from '../src/game/LabMechanismReflections.js';
import {architecturalRectOverlapsPortal} from '../src/game/LabArchitecturalModels.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

const assets=await createHeadlessGame();
after(()=>{assets.physics.dispose();assets.portals.dispose();});
const V=(...v)=>new THREE.Vector3(...v);
function fixture(index,profile,{openSky=true}={}){
 const game=new LabGame({container:null,touch:false});game.assets=assets.assets;game.levelIndex=index;
 game.scene=new THREE.Scene();game.scene.fog=new THREE.Fog(0x123456,64,120);game.camera=assets.camera.clone();
 game.materials=Object.fromEntries(Object.entries(assets.materials).map(([key,mat])=>[key,mat.clone()]));
 game.cargo={position:V(100,100,100),velocity:V(),quaternion:new THREE.Quaternion()};game.portals={ready:false};game.label=()=>new THREE.Object3D();
 const k=new Workshop(game,{id:'chapter-art-contract',title:'Fixture',accent:0x123456,hints:[],description:'Art contract'},index),w=k.world;
 if(profile)configureChapterWorld(w,profile,{openSky});
 k.shell({minX:-14,maxX:14,minZ:-12,maxZ:12},18);
 w.floor(-10,0,-10,-3,7,{name:'Raised painted landing'});
 k.panel('ceramic',[-13.8,4,0],[1,0,0],5.6,4.6);
 const custom=w.surface({name:'Author coloured wall',position:[9,3,3],normal:[0,0,1],width:5,height:4});
 custom.group.userData.keepMaterial=true;
 const paint=new THREE.MeshStandardMaterial({color:0x318952,roughness:.55});
 custom.group.traverse(node=>{if(node.isInstancedMesh)node.material=paint;});
 const level=k.finish([0,0,8],[2,.55,8],[0,0,-8],{workshop:k});game.firstLevel=level;
 return {game,level,world:w,custom,paint};
}
const finish=level=>finishChapterArt(applyMechanismReflections(applyPremiumBrowser3DArt(upgradeBrowser3DArt(finishAdvancedRoom(level)))));

for(const [profile,index] of [['garden',23],['carnival',26],['lagoon',27],['inversion',28],['launch',29]])test(`${profile} uses broad authored colours without changing physics or hiding ceramic`,()=>{
 const {game,level,world,custom,paint}=fixture(index,profile),before=gameplayContract(game),p=CHAPTER_VISUAL_PROFILES[profile];
 assert.equal(world.surfaces.some(surface=>surface.name==='Non-portal ceiling tiles'),false,'open sky must be chosen before shell construction');
 const counts={ticks:level.workshop.ticks.length,renders:level.workshop.renders.length};
 finish(level);
 assert.deepEqual(gameplayContract(game),before,'colour/finish work changed the authored gameplay contract');
 assert.equal(game.scene.background.getHex(),p.sky);assert.equal(game.scene.fog.color.getHex(),p.sky);
 assert.equal(game.scene.fog.near,64);assert.equal(game.scene.fog.far,120,'room-specific visibility belongs to its lifecycle');
 assert.equal(world.materials.wall.color.getHex(),p.wall);assert.equal(world.materials.floor.color.getHex(),p.low);
 assert.equal(level.chapterArt.profile,profile);assert.equal(level.chapterArt.perFrameCallbacks,0);
 assert.equal(level.workshop.ticks.length,counts.ticks);assert.equal(level.workshop.renders.length,counts.renders);
 custom.group.traverse(node=>{if(node.isInstancedMesh){assert.equal(node.material,paint);assert.equal(node.visible,true);}});
 assert.equal(paint.color.getHex(),0x318952);
 for(const surface of world.surfaces.filter(surface=>surface.portal))surface.group.traverse(node=>{
  if(node.isInstancedMesh&&node.userData.portalTile){assert.equal(node.material,world.materials.ceramic);assert.equal(node.material.color.getHex(),0xf4f1e8);}
 });
 const premium=level.premiumBrowser3DArt;
 assert.equal(premium.userData.stats.pointLights,0);assert.equal(premium.userData.stats.directionalLights,1);
 assert.equal(premium.userData.stats.ventPanels,0);assert.equal(level.browser3DArt.userData.stats.conduits,0);
 assert.ok(premium.userData.stats.batches<=2,'colour blocking uses the existing frame and coat batches');
 const coat=premium.children.find(node=>node.isInstancedMesh&&node.name==='Architectural coat / cassette'),colors=new Set(),c=new THREE.Color();
 for(let i=0;i<coat.count;i++){coat.getColorAt(i,c);colors.add(c.getHex());}
 for(const color of [p.wall,p.secondary,p.low,p.high])assert.ok(colors.has(color),`missing broad material family ${color.toString(16)}`);
 for(const coverage of premium.userData.architecturalCoverage){
  const rect={...coverage,center:V(...coverage.center),normal:V(...coverage.normal),up:V(...coverage.up),right:V(...coverage.right)};
  for(const surface of Object.values(level.panels))assert.equal(architecturalRectOverlapsPortal(rect,surface.getFrame(),0),false);
 }
 const lights=[];world.root.traverse(node=>{if(node.isLight)lights.push(node);});
 const childCount=world.root.children.length;finishChapterArt(level);applyPremiumBrowser3DArt(level);
 assert.equal(world.root.children.length,childCount);assert.equal(lights.length,1,'one scene fill, not another light per vista');
});

test('ordinary chapters keep their roof and palette without opting into a new visual profile',()=>{
 const {game,level,world}=fixture(21,null);
 assert.ok(world.surfaces.some(surface=>surface.name==='Non-portal ceiling tiles'));
 finish(level);assert.equal(level.chapterArt,undefined);assert.equal(world.materials.wall.color.getHex(),0x718780);
 assert.equal(game.scene.background.getHex(),0x384e48);
 assert.throws(()=>configureChapterWorld(world,'garden'),/before building/);
});
