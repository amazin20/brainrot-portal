// A stylized coherent FIELD/resonator, not metre-wavelength visible light.
// All phase lengths are actual finite free-flight segments. A renderer may
// draw their phase crests; no load/contact/solved flag is accepted here.
const EPS=1e-8,TAU=2*Math.PI;
const vec=v=>Array.isArray(v)?[...v]:[v.x,v.y,v.z];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const finite=v=>v.length===3&&v.every(Number.isFinite);
function unit(v){const a=vec(v),l=length(a);if(!finite(a)||l<EPS)throw new RangeError('Finite nonzero direction required');return mul(a,1/l);}
function positive(x,label){if(!Number.isFinite(x)||x<=0)throw new RangeError(label+' must be positive and finite');return x;}
const value=x=>typeof x==='function'?x():x;
function faceFrame(face){
 const center=vec(value(face.center)),normal=unit(value(face.normal));
 if(!finite(center))throw new RangeError('Finite face center required');
 const proposed=face.tangent?vec(value(face.tangent)):(Math.abs(normal[2])<.9?[0,0,1]:[1,0,0]);
 const across=unit(sub(proposed,mul(normal,dot(proposed,normal)))),up=cross(normal,across);
 return{center,normal,across,up,halfWidth:positive(face.halfWidth,'Face halfWidth'),halfHeight:positive(face.halfHeight,'Face halfHeight')};
}

/** Finite mirror/input/blocker/portal planes; no authored length parameter.
 * A missed aperture, wrong input face or exhausted path supplies no input.
 * Mirrors are two-sided. Inputs accept only their declared front direction. */
export function traceCastleCoherentArm({origin,direction,faces,inputId,maxDistance=128,maxInteractions=12}){
 let at=vec(origin),ray=unit(direction),remaining=positive(maxDistance,'Ray length'),total=0;
 if(!finite(at)||!Array.isArray(faces)||!Number.isSafeInteger(maxInteractions)||maxInteractions<1)throw new RangeError('Valid finite ray geometry required');
 const segments=[];
 for(let bounce=0;bounce<maxInteractions;bounce++){
  let closest=null;
  for(const face of faces){
   if(face.enabled===false)continue;
   if(!['mirror','input','blocker','portal'].includes(face.kind))throw new RangeError('Unknown coherent-field face');
   const f=faceFrame(face),den=dot(ray,f.normal);if(Math.abs(den)<EPS)continue;
   const distance=dot(sub(f.center,at),f.normal)/den;
   if(distance<=EPS||distance>remaining+EPS||closest&&(distance>closest.distance+EPS||Math.abs(distance-closest.distance)<=EPS&&(face.kind!=='portal'||closest.face.kind==='portal')))continue;
   const hit=add(at,mul(ray,distance)),relative=sub(hit,f.center);
   const u=dot(relative,f.across),v=dot(relative,f.up);
   if(face.kind==='portal'?(u/f.halfWidth)**2+(v/f.halfHeight)**2>1+EPS:Math.abs(u)>f.halfWidth+EPS||Math.abs(v)>f.halfHeight+EPS)continue;
   closest={face,frame:f,distance,hit,den};
  }
  if(!closest)return{reached:false,reason:'miss',inputId:null,length:total,segments};
  const h=closest;total+=h.distance;remaining-=h.distance;
  segments.push({a:at,b:h.hit,length:h.distance,startDistance:total-h.distance,endDistance:total,faceId:h.face.id,kind:h.face.kind});
  if(h.face.kind==='input'){
   const reached=h.den<-EPS&&h.face.id===inputId;
   return{reached,reason:reached?'input':h.den>=-EPS?'back-of-input':'wrong-input',inputId:h.face.id,length:total,segments};
  }
  if(h.face.kind==='blocker')return{reached:false,reason:'blocked',inputId:null,length:total,segments};
  if(h.face.kind==='portal'){
   if(h.den>=-EPS)return{reached:false,reason:'back-of-portal',inputId:null,length:total,segments};
   const partner=faces.find(f=>f.id===h.face.partnerId&&f.kind==='portal'&&f.enabled!==false);
   if(!partner||partner.partnerId!==h.face.id)return{reached:false,reason:'unpaired-portal',inputId:null,length:total,segments};
   const exit=faceFrame(partner),relative=sub(h.hit,h.frame.center),x=-dot(relative,h.frame.across),y=dot(relative,h.frame.up);
   if((x/exit.halfWidth)**2+(y/exit.halfHeight)**2>1+EPS)return{reached:false,reason:'miss-exit-aperture',inputId:null,length:total,segments};
   at=add(exit.center,add(mul(exit.across,x),mul(exit.up,y)));
   ray=unit(add(mul(exit.across,-dot(ray,h.frame.across)),add(mul(exit.up,dot(ray,h.frame.up)),mul(exit.normal,-dot(ray,h.frame.normal)))));
   // An ideal phase-preserving portal has zero internal path. Start at the
   // exact mapped mouth and reject t<=EPS on the next intersection; a visual
   // anti-acne offset must never shorten geometric optical length by7cm.
   segments.at(-1).portalExit=at;segments.at(-1).portalPartnerId=partner.id;
   continue;
  }
  at=h.hit;ray=unit(sub(ray,mul(h.frame.normal,2*dot(ray,h.frame.normal))));
  if(remaining<=EPS)break;
 }
 return{reached:false,reason:'path-budget',inputId:null,length:total,segments};
}

/** Real orthogonal 50:50 hybrid: [a+b,a-b]/sqrt(2).
 * It is unitary for unequal or absent inputs too. Redistribution never adds
 * source power; an absent arm produces equal outputs, not a dark output. */
export function balancedCastleCoupler(powerA,powerB,lengthA,lengthB,wavelength){
 positive(wavelength,'Stylized field wavelength');
 if([powerA,powerB].some(p=>!Number.isFinite(p)||p<0)||![lengthA,lengthB].every(Number.isFinite))throw new RangeError('Finite nonnegative powers and path lengths required');
 const inputPower=powerA+powerB,deltaLength=lengthA-lengthB,phase=TAU*deltaLength/wavelength;
 const interference=Math.sqrt(powerA*powerB)*Math.cos(phase);
 const plus=Math.max(0,Math.min(inputPower,inputPower/2+interference)),minus=inputPower-plus;
 return{inputPower,outputPlus:plus,outputMinus:minus,deltaLength,phase,conservationError:plus+minus-inputPower};
}

export function measureCastleCoherentField({arms,wavelength=4,sourcePower=80}){
 if(!Number.isFinite(sourcePower)||sourcePower<0||!Array.isArray(arms)||arms.length!==2)throw new RangeError('One finite source and two actual arms required');
 const traces=arms.map(traceCastleCoherentArm),splitPower=sourcePower/2;
 const inputs=traces.map(t=>t.reached?splitPower:0);
 const coupler=balancedCastleCoupler(inputs[0],inputs[1],traces[0].length,traces[1].length,wavelength);
 return{model:'stylized coherent field/resonator',wavelength,sourcePower,traces,inputs,bothArmsReach:traces.every(t=>t.reached),absorbedBeforeCoupler:sourcePower-coupler.inputPower,...coupler};
}

/** Quarter-wave landmarks for a renderer, sampled by accumulated geometric
 * distance through reflections. A slow display phase changes drawing only. */
export function castleFieldPhaseSamples(trace,{wavelength=4,time=0,displayCyclesPerSecond=.25}={}){
 positive(wavelength,'Stylized field wavelength');
 if(!Number.isFinite(time)||!Number.isFinite(displayCyclesPerSecond))throw new RangeError('Finite display time required');
 const spacing=wavelength/4,samples=[];
 for(const s of trace.segments){
  for(let n=Math.ceil((s.startDistance-EPS)/spacing);n*spacing<=s.endDistance+EPS;n++){
   const distance=n*spacing;if(samples.length&&Math.abs(samples.at(-1).distance-distance)<EPS)continue;
   const fraction=Math.max(0,Math.min(1,(distance-s.startDistance)/s.length)),position=add(s.a,mul(sub(s.b,s.a),fraction));
   samples.push({position,distance,phase:TAU*(distance/wavelength-time*displayCyclesPerSecond)});
  }
 }
 return samples;
}
