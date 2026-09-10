import * as THREE from 'three';

const PALETTES=[
 {wall:0x74807b,low:0x83918d,high:0xb9a184,edge:0xd6b889},
 {wall:0x707f8b,low:0x8696a2,high:0xa49fb5,edge:0x9bcddd},
 {wall:0x687f79,low:0x829c91,high:0xb5b08c,edge:0xa4dbca},
];
const DIGITS={
 '1':['010','110','010','010','111'],'2':['110','001','010','100','111'],
 '3':['110','001','010','001','110'],'4':['101','101','111','001','001'],
 '5':['111','100','110','001','110'],
};
/** Finishes follow existing structural faces. No new collision, target,
 * light source or per-frame work; powered surfaces keep their own material. */
export function finishAdvancedRoom(level){
 const world=level.world,palette=PALETTES[level.index-12];
 if(!palette||!world)return level;
 const spawn=level.spawn.toArray?.()??level.spawn;
 level.conceptLesson=[
  {position:level.panels['mirror-cradle']?.getFrame().center.toArray()??spawn,key:'↔',text:'Луч проходит через порталы и отражается от зеркала. Вес меняет угол отражения.'},
  {position:spawn,range:13,key:'↔',text:'Твёрдый свет держит вес. Переставляя портал, ты переносишь и опору.'},
  {position:spawn,range:13,key:'↔',text:'Поток удерживает вес и проходит через порталы. Обратное направление тянет предметы назад.'},
 ][level.index-12];
 const root=new THREE.Group();root.name='Interlaced chamber architectural finishes';root.userData.visualOnly=true;world.root.add(root);
 world.materials.wall.color.setHex(palette.wall);world.materials.wall.emissive.setHex(palette.wall);world.materials.wall.emissiveIntensity=.045;
 world.materials.trim.color.setHex(0x526762);world.materials.trim.roughness=.85;world.materials.trim.metalness=.1;
 world.materials.trim.emissive.setHex(0x526762);world.materials.trim.emissiveIntensity=.10;
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.87,metalness:.08});
 const tint=new THREE.Color(),solid=[],lamps=[];
 const add=(list,p,s,color)=>list.push({p,s,color});
 const floors=world.surfaces.filter(s=>s.floor&&!s.portal&&!s.collider.kinematic);
 for(const surface of world.surfaces){
  if(surface.portal||surface.collider.kinematic||surface.group.userData.keepMaterial)continue;
  const y=surface.getFrame().center.y;
  const color=Math.abs(surface.normal.y)>.9?(y>5?palette.high:palette.low):palette.wall;
  surface.group.traverse(mesh=>{
   if(!mesh.isInstancedMesh||mesh.userData.portalTile||mesh.count===0)return;mesh.material=material;
   for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,tint.setHex(color).multiplyScalar(i%7===0?.975:1));
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  });
 }
 for(const {floor:f,name} of floors){
  if(f.y<1||/stair|step/i.test(name))continue;
  for(const [axis,at,a,b,side] of [['x',f.minX,f.minZ,f.maxZ,-1],['x',f.maxX,f.minZ,f.maxZ,1],['z',f.minZ,f.minX,f.maxX,-1],['z',f.maxZ,f.minX,f.maxX,1]]){
   const n=Math.max(1,Math.ceil((b-a)/4)),span=(b-a)/n;
   for(let i=0;i<n;i++){
    const mid=a+span*(i+.5),face=at+side*.014;
    add(solid,axis==='x'?[face,f.y-.16,mid]:[mid,f.y-.16,face],axis==='x'?[.02,.14,span-.05]:[span-.05,.14,.02],palette.high);
    if(i===0||i===n-1)add(lamps,axis==='x'?[face+side*.015,f.y-.16,mid]:[mid,f.y-.16,face+side*.015],axis==='x'?[.007,.035,.32]:[.32,.035,.007],palette.edge);
   }
  }
 }
 // The chamber number is painted on its real outer wall; no floating signage
 // or additional white tiles that could be mistaken for a portal target.
 const wall=world.surfaces.find(s=>!s.portal&&s.normal.z>.9&&s.width>12&&s.height>6);
 if(wall){
  const frame=wall.getFrame(),text=String(level.index+1),step=.31;
  for(let k=0;k<text.length;k++)DIGITS[text[k]]?.forEach((row,y)=>[...row].forEach((v,x)=>{
   if(v!=='1')return;
   const p=frame.center.clone().addScaledVector(frame.right,wall.width/2-4+(k*4+x)*step).addScaledVector(frame.up,1-y*step).addScaledVector(frame.normal,.015);
   add(lamps,p.toArray(),[step*.82,step*.82,.012],palette.edge);
  }));
 }
 const geometry=new THREE.BoxGeometry(1,1,1),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion();
 for(const [name,entries,mat] of [['Mounted structural fascias',solid,material],['Inlaid light inserts and room number',lamps,new THREE.MeshBasicMaterial({color:0xffffff})]]){
  if(!entries.length)continue;const mesh=new THREE.InstancedMesh(geometry,mat,entries.length);mesh.name=name;mesh.userData.visualOnly=true;
  entries.forEach((e,i)=>{matrix.compose(position.fromArray(e.p),q,scale.fromArray(e.s));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,tint.setHex(e.color));});
  mesh.computeBoundingSphere();root.add(mesh);
 }
 root.userData.floorCount=floors.length;root.userData.palette=palette;level.architecture=root;return level;
}
