/** Exploratory input route, deliberately separate from the puzzle solution.
 * Starts at the normal room-30 spawn via runV8Journey. No actor position,
 * velocity, collider, portal, mechanism target or win condition is assigned.
 * The same function runs headlessly and in the production WebGL browser. */
export function runRampExploration(d,observe=()=>{}){
 const {game:g,walk,wait,frame,worldMove,stop,mark}=d;
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const stats={jumps:0,landings:0,rampSamples:0,minimumSurfaceGap:0};
 const height=(r,z)=>r.lowY+(r.highY-r.lowY)*(r.highAt==='minZ'?(r.maxZ-z):(z-r.minZ))/(r.maxZ-r.minZ);
 function cross(name,x,z,heading){
  const ramp=g.ramps.find(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ);
  check(ramp&&!ramp.profile,'This room must retain a real linear incline at the approach');
  walk(x,z);wait(.25);let airborne=false;
  for(let n=0;n<120;n++){
   // Run, jump, make diagonal corrections and try jumping again after landing.
   if(n%33===0&&g.playerGrounded){g.input.jumpQueued=true;stats.jumps++;}
   g.input.keys.add('ShiftLeft');worldMove(Math.sin(n*.08)*.12,heading);frame();
   const p=g.playerPosition,gap=p.y-height(ramp,p.z);
   if(!g.playerGrounded&&gap>.10)airborne=true;
   if(airborne&&g.playerGrounded){stats.landings++;airborne=false;}
   if(p.x>ramp.minX+.5&&p.x<ramp.maxX-.5&&p.z>ramp.minZ+.5&&p.z<ramp.maxZ-.5){
    stats.minimumSurfaceGap=Math.min(stats.minimumSurfaceGap,gap);stats.rampSamples++;
    check(gap>=-.015,`${name}: below the visible slope by ${-gap} at ${p.toArray()}`);
   }
   observe({section:name,frame:n,position:p.toArray(),grounded:g.playerGrounded,surfaceGap:gap});
  }
  stop();wait(.6);mark(name);
 }
 walk(-46,20);cross('First incline: running jumps and restart',-46,12,-1);
 walk(-46,-49);walk(-34,-49);cross('Second incline: opposite orientation',-34,-40,1);
 walk(-34,8);mark('Both ramp-to-landing joins reached by ordinary walking');
 cross('Second incline: return from the high landing',-34,-3,-1);
 walk(-34,-49);walk(-46,-49);cross('First incline: downhill jumps and restart',-46,-37,1);
 walk(-46,20);walk(-29,31);mark('Returned to the actual spawn without a reset');
 check(stats.jumps>=6&&stats.landings>=4,'Repeated takeoffs and landings were not exercised');
 return stats;
}
