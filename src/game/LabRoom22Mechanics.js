import * as THREE from 'three';
/** One opposed hydraulic linkage. Its state is actual piston displacement:
 * unloading closes the ground throat and opens the upper inspection passage. */
export function buildRoom22Shutters(k,pad){
 const {game:g,world:w}=k, travel=5.4;
 const make=(p,size)=>{const mesh=w.box(p,size,w.materials.wall);const collider=g.colliders.find(c=>c.mesh===mesh);collider.kinematic=true;return {mesh,collider,base:p[1]};};
 const lower=make([0,2.7,12],[.65,5.4,6]),upper=make([12,9.7,-8],[20,5.4,.65]);
 const bars=[w.box([-.42,2.7,9.2],[.15,5.1,.12],w.materials.accent,false),w.box([-.42,2.7,14.8],[.15,5.1,.12],w.materials.accent,false)];
 const state={progress:0,loaded:false,lower,upper,update(dt){
  state.loaded=pad.loaded();const target=state.loaded?1:0;
  state.progress+=THREE.MathUtils.clamp(target-state.progress,-dt*.9,dt*.9);
  for(const [part,offset] of [[lower,state.progress*travel],[upper,(1-state.progress)*travel]]){
   part.mesh.position.y=part.base+offset;part.mesh.updateWorldMatrix(true,false);part.collider.box.setFromObject(part.mesh);g.physics?.updateStaticBox(part.mesh.uuid,part.collider.box,dt);
  }
  bars.forEach(b=>b.position.y=2.7+state.progress*travel);
 },reset(){state.progress=0;state.update(0);}};
 k.ticks.push(dt=>state.update(dt));k.resets.push(()=>state.reset());k.state.shutters=state;
 k.wire([[-12,.3,0],[-18,.3,0],[-18,.3,12],[-.8,.3,12]],()=>state.loaded);
 k.wire([[.9,6.4,12],[3,6.4,12],[3,6.4,-8],[12,6.4,-8]],()=>!state.loaded);
 return state;
}
