import * as THREE from 'three';
import {createPlanter,createDrive,createCanopy,createGuideRing,createCrystal,createPontoon,createSolarObservatory} from '../src/game/LabSolidModels.js';
const factories={planter:createPlanter,drive:createDrive,canopy:createCanopy,ring:createGuideRing,crystal:createCrystal,pontoon:()=>createPontoon(8.8,7.8),solar:createSolarObservatory};
window.showModel=(kind)=>{
 const model=factories[kind](),scene=new THREE.Scene();scene.background=new THREE.Color(0xe9ecef);
 scene.add(model);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const camera=new THREE.PerspectiveCamera(36,1200/900,.1,1000);camera.position.copy(center).add(new THREE.Vector3(1,.70,1.2).normalize().multiplyScalar(extent*2.05));camera.lookAt(center);
 scene.add(new THREE.HemisphereLight(0xe9f4ff,0x736556,2.1));const key=new THREE.DirectionalLight(0xffefdb,3.2);key.position.copy(center).add(new THREE.Vector3(6,11,5).multiplyScalar(extent*.3));key.target.position.copy(center);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:extent*10});key.shadow.normalBias=.02;scene.add(key,key.target);
 const rim=new THREE.DirectionalLight(0xcde4ff,1.5);rim.position.copy(center).add(new THREE.Vector3(-10,5,-3));scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(extent*30,extent*30),new THREE.MeshStandardMaterial({color:0xc8cdd0,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=bounds.min.y-.015;floor.receiveShadow=true;scene.add(floor);
 document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';renderer.render(scene,camera);window.__renderStats={kind,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
};
