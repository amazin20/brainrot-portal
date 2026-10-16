/** Ordinary production inputs only; neither helper establishes native visibility.
 * Keep each export self-contained: the native recorder serializes it separately. */
export function room25LoadedObservation(d,onPhase=()=>{},onInput=()=>{}){
 const {game,level}=d;
 const input=(kind,...args)=>{
  const firstWorldStep=game.physics.world.stepnumber;
  const values=args.map(value=>value?.toArray?.()??value);
  const result=d[kind](...args);
  onInput({kind,value:values.length===1?values[0]:values,firstWorldStep,lastWorldStep:game.physics.world.stepnumber});
  return result;
 };
 input('walk',-7,8.7);input('walk',-3,6);
 const midpoint=game.cargo.position.clone().add(level.state.optical.movingMirror.position.clone()).multiplyScalar(.5);
 input('look',midpoint);onPhase('loaded-support');input('wait',2);
}

export function room25NearObservationLoop(d,onPhase=()=>{},onInput=()=>{}){
 const {game,level}=d,o=level.state.optical,Vector=game.playerPosition.constructor;
 const input=(kind,...args)=>{
  const firstWorldStep=game.physics.world.stepnumber;
  const values=args.map(value=>value?.toArray?.()??value);
  const result=d[kind](...args),accepted=kind==='aim'?game.portalShots.lastImpact?.valid===true:undefined;
  onInput({kind,value:values.length===1?values[0]:values,firstWorldStep,lastWorldStep:game.physics.world.stepnumber,
   ...(kind==='aim'?{accepted}:{})});
  if(kind==='aim'&&!accepted)throw Error('Actual charged portal impact was rejected');
  return result;
 };
 const walk=(x,z)=>input('walk',x,z),lookMirror=()=>input('look',o.movingMirror.position.clone());
 walk(-14,-13);walk(-14,-10);walk(-7,-10);walk(-8.6,7.9);lookMirror();
 onPhase('lit-gallery');input('wait',2);
 walk(-7,-10);walk(-14,-10);walk(-14,-13);
 input('aim',1,level.panels['freight-receiver'].getFrame().center.clone().add(new Vector(0,0,1.45)));
 walk(-14,-8.5);input('look',o.movingMirror.position.clone().add(new Vector(0,-1.2,0)));
 onPhase('dark-return');input('wait',2);
 walk(-20,-13);walk(-20,-10);input('wait',1);
 if(!game.playerGrounded||game.playerPosition.y>.1)throw Error('Traveller did not land normally on the actual lower floor');
 walk(-14,-10);walk(-11.8,7.9);
 input('aim',1,level.panels['lower-relay'].getFrame().center);lookMirror();
 onPhase('relight-ascent');input('wait',2);
 walk(-14,7.9);walk(-14,-10);input('wait',5);
 if(!game.playerGrounded||game.playerPosition.y<8.97)throw Error('Actual first passenger car did not restore the founded gallery');
 walk(-14,-13);walk(-6,-13);walk(-3,-14.5);
}
