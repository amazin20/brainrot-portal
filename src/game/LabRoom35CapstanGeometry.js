const TAU=Math.PI*2;
const clearanceCaches=new WeakMap();
export const ropeVector={
 add:(a,b)=>a.map((x,i)=>x+b[i]),sub:(a,b)=>a.map((x,i)=>x-b[i]),scale:(a,s)=>a.map(x=>x*s),
 dot:(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),length:a=>Math.hypot(...a),
 unit(a){const n=Math.hypot(...a);return a.map(x=>x/n);},
};
const {add,sub,scale,dot,length,unit}=ropeVector;
const turn=a=>(a%TAU+TAU)%TAU;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

function pointBoxDistance(point,part){
 const d=sub(point,part.center),c=Math.cos(part.angle),s=Math.sin(part.angle),p=[d[0]*c+d[1]*s,-d[0]*s+d[1]*c,d[2]];
 return Math.hypot(...p.map((x,i)=>Math.max(0,Math.abs(x)-part.half[i])));
}

/** The two external strands cross in XY. Their actual helical axial offset,
 * rather than a renderer-only kink, supplies the physical separation. */
export function segmentSeparation(a,b,c,d){
 const u=sub(b,a),v=sub(d,c),w=sub(a,c),A=dot(u,u),B=dot(u,v),C=dot(v,v),D=dot(u,w),E=dot(v,w),den=A*C-B*B;
 let s=den>1e-12?(B*E-C*D)/den:0;s=Math.max(0,Math.min(1,s));
 let t=C>0?(B*s+E)/C:0;t=Math.max(0,Math.min(1,t));
 s=A>0?Math.max(0,Math.min(1,(B*t-D)/A)):0;
 return {distance:length(sub(add(a,scale(u,s)),add(c,scale(v,t)))),s,t};
}

/** Authoring coordinates only. Runtime tracing derives both tangencies and
 * winding from these actual points, the entry collar and current aperture. */
export function createRoom35CapstanGuide({center=[12,20,10],radius=.65,pitch=.20,ropeRadius=.04}={}){
 const k=pitch/TAU,a=4,leg=Math.sqrt(a*a-radius*radius),alpha=Math.PI+Math.acos(radius/a);
 const contact=add(center,[radius*Math.cos(alpha),radius*Math.sin(alpha),0]);
 const tangent=unit([-radius*Math.sin(alpha),radius*Math.cos(alpha),k]);
 const guide={center:[...center],radius,pitch,k,ropeRadius,grooveHalfWidth:.065,outerKeeperRadius:radius+.105,
  loadPoint:add(center,[-a,0,-leg*k/radius]),
  entryCollar:{center:sub(contact,scale(tangent,.30)),axis:tangent,clearRadius:.055},
  grooveStart:contact,grooveEndTurn:5.45,
  /** These centres lie on a true equal-length involute. No route name or
   * mode is passed to the force model. A future game face must enforce this
   * physical locus or account for any placement work explicitly. */
  portalAt(theta){
   const beta=alpha+theta,s=4-radius*theta;
   if(!(s>.1))throw new RangeError('The finite involute has ended');
   const t=unit([-radius*Math.sin(beta),radius*Math.cos(beta),k]);
   const contact=add(center,[radius*Math.cos(beta),radius*Math.sin(beta),k*theta]);
   return {position:add(contact,scale(t,s*Math.hypot(radius,k)/radius)),normal:scale(t,-1),halfWidth:.25,halfHeight:.25};
  },
 };
 // These are real manufactured exit holes. Their centres follow from the
 // fixed tube/helix intersection, not from a runtime selected route name.
 const outer=guide.outerKeeperRadius,exitDistance=Math.sqrt(outer*outer-radius*radius);
 guide.exitWindows=[.35,4.8].map(turn=>{
  const phi=alpha+turn,t=unit([-radius*Math.sin(phi),radius*Math.cos(phi),k]);
  const contact=add(center,[radius*Math.cos(phi),radius*Math.sin(phi),k*turn]);
  return {center:add(contact,scale(t,exitDistance*Math.hypot(radius,k)/radius)),axis:t,clearRadius:.115};
 });
 guide.solidParts=[];
 // Physical lips and outer hood enclose the actual helical contact path.
 // Each exit window is a hole through this hood, with a tangent neck.
 const steps=Math.ceil(guide.grooveEndTurn/.07);
 for(let i=0;i<=steps;i++){
  const t=guide.grooveEndTurn*i/steps,phi=alpha+t;
  for(const z of [-.105,.105])guide.solidParts.push({role:'helical groove lip',center:add(center,[(radius+.015)*Math.cos(phi),(radius+.015)*Math.sin(phi),k*t+z]),half:[.06,.027,.04],angle:phi});
  const p=add(center,[(radius+.145)*Math.cos(phi),(radius+.145)*Math.sin(phi),k*t]);
  if(!guide.exitWindows.some(w=>length(sub(p,w.center))<.24))guide.solidParts.push({role:'radial keeper hood',center:p,half:[.04,.027,.15],angle:phi});
 }
 for(const p of guide.solidParts){Object.freeze(p.center);Object.freeze(p.half);Object.freeze(p);}
 Object.freeze(guide.solidParts);Object.freeze(guide.center);Object.freeze(guide.loadPoint);Object.freeze(guide.grooveStart);
 Object.freeze(guide.entryCollar.center);Object.freeze(guide.entryCollar.axis);Object.freeze(guide.entryCollar);
 for(const w of guide.exitWindows){Object.freeze(w.center);Object.freeze(w.axis);Object.freeze(w);}Object.freeze(guide.exitWindows);
 return Object.freeze(guide);
}

/** Current tangent geometry through one real aperture. The founded entry
 * collar fixes chirality; the helical keeper prevents a chord/short unwrap.
 * No supplied theta, panel ID or completion state is read. */
export function traceRoom35Capstan(guide,portal){
 if(!portal||portal.halfWidth<guide.ropeRadius||portal.halfHeight<guide.ropeRadius)return null;
 const C=guide.center,R=guide.radius,A=guide.loadPoint,B=portal.position,a=sub(A,C),b=sub(B,C);
 const da=Math.hypot(a[0],a[1]),db=Math.hypot(b[0],b[1]);if(da<=R||db<=R)return null;
 const entryArg=Math.atan2(a[1],a[0]),exitArg=Math.atan2(b[1],b[0]),entries=[entryArg-Math.acos(R/da),entryArg+Math.acos(R/da)];
 for(const alpha of entries){
  const T0=add(C,[R*Math.cos(alpha),R*Math.sin(alpha),guide.grooveStart[2]-C[2]]),incoming=unit(sub(T0,A));
  if(dot(incoming,guide.entryCollar.axis)<1-1e-8)continue;
  const collarDistance=length(cross(sub(guide.entryCollar.center,A),incoming));
  if(collarDistance>guide.entryCollar.clearRadius-guide.ropeRadius)continue;
  const ccw=unit([-R*Math.sin(alpha),R*Math.cos(alpha),guide.k]);
  const winding=Math.sign(dot(incoming,ccw));if(!winding)continue;
  for(const rawBeta of [exitArg-Math.acos(R/db),exitArg+Math.acos(R/db)]){
   const theta=turn((rawBeta-alpha)*winding);if(theta<.02||theta>guide.grooveEndTurn)continue;
   const beta=alpha+winding*theta,T1=add(C,[R*Math.cos(beta),R*Math.sin(beta),(T0[2]-C[2])+guide.k*theta]);
   const outgoing=unit(sub(B,T1)),helixEnd=unit([-winding*R*Math.sin(beta),winding*R*Math.cos(beta),guide.k]);
   if(dot(outgoing,helixEnd)<1-1e-8||dot(outgoing,unit(portal.normal))>-.999999)continue;
   const planLength=Math.hypot(B[0]-T1[0],B[1]-T1[1]),hoodLength=Math.sqrt(guide.outerKeeperRadius**2-R**2);
   if(planLength<hoodLength)continue;
   const hoodPoint=add(T1,scale(outgoing,hoodLength*Math.hypot(R,guide.k)/R));
   const opening=guide.exitWindows.find(w=>length(sub(hoodPoint,w.center))<=w.clearRadius-guide.ropeRadius&&dot(w.axis,outgoing)>.98);
   if(!opening)continue;
   const points=[A,T0],steps=Math.ceil(theta/.04);
   for(let i=1;i<=steps;i++){const t=theta*i/steps,phi=alpha+winding*t;points.push(add(C,[R*Math.cos(phi),R*Math.sin(phi),(T0[2]-C[2])+guide.k*t]));}
   points.push(B);
   const arcLength=Math.hypot(R,guide.k)*theta,curvatureTurn=theta*R/Math.hypot(R,guide.k);
   const crossing=segmentSeparation(A,T0,T1,B);
   if(crossing.distance<guide.ropeRadius*2+.005)continue;
   const key=[...portal.position,...portal.normal,portal.halfWidth,portal.halfHeight].join(','),cache=Object.isFrozen(guide)?(clearanceCaches.get(guide)??new Map()):null;
   let solidClearance=cache?.get(key);
   if(solidClearance===undefined){
    solidClearance=Infinity;const samples=[...points];
    for(const [a,b]of [[A,T0],[T1,B]]){const n=Math.ceil(length(sub(b,a))/.01);for(let i=1;i<n;i++)samples.push(add(a,scale(sub(b,a),i/n)));}
    for(const point of samples)for(const part of guide.solidParts)solidClearance=Math.min(solidClearance,pointBoxDistance(point,part)-guide.ropeRadius);
    // Exact immutable solids plus actual aperture coordinates form the key.
    //5mm is the Lipschitz sampling bound, not a contact penetration allowance.
    solidClearance-=.005;if(cache){cache.set(key,solidClearance);clearanceCaches.set(guide,cache);}
   }
   if(solidClearance<0)continue;
   return {theta,curvatureTurn,arcLength,length:length(sub(T0,A))+arcLength+length(sub(B,T1)),
    entryTangent:T0,exitTangent:T1,incoming,outgoing,points,crossing,keeperClearance:solidClearance,
    throatClearance:Math.min(portal.halfWidth,portal.halfHeight)-guide.ropeRadius,exitHoleClearance:opening.clearRadius-guide.ropeRadius-length(sub(hoodPoint,opening.center))};
  }
 }
 return null;
}

/** Two unilateral springs share a fixed total rope length. A massless slip
 * projection can only reduce their elastic energy. Unequal tensions react
 * against the founded drum, never act as a lifting-force multiplier. */
export function projectRoom35Capstan({leftLength,rightLength,leftRest,rightRest,slip=0,stiffness=3000,mu=.4,curvatureTurn=0}){
 const ratio=Math.exp(mu*curvatureTurn),energy=s=>.5*stiffness*(Math.max(0,leftLength-leftRest-s)**2+Math.max(0,rightLength-rightRest+s)**2);
 const before=energy(slip),left=stiffness*Math.max(0,leftLength-leftRest-slip),right=stiffness*Math.max(0,rightLength-rightRest+slip);
 let next=slip;
 if(left>ratio*right+1e-9)next=((leftLength-leftRest)-ratio*(rightLength-rightRest))/(1+ratio);
 else if(right>ratio*left+1e-9)next=(ratio*(leftLength-leftRest)-(rightLength-rightRest))/(1+ratio);
 // If both branches can be slack, material moves only far enough to release
 // the initially taut branch. The interval carries exactly zero force.
 const slackMin=leftLength-leftRest,slackMax=rightRest-rightLength;
 if(slackMin<=slackMax)next=Math.max(slackMin,Math.min(slackMax,next));
 const after=energy(next),heat=before-after;
 if(heat< -1e-7)throw new Error('Capstan projection would create elastic energy');
 return {slip:next,leftTension:stiffness*Math.max(0,leftLength-leftRest-next),rightTension:stiffness*Math.max(0,rightLength-rightRest+next),
  elasticEnergy:after,frictionHeat:Math.max(0,heat),materialTravel:next-slip,ratio};
}

/** Orthogonal projection of a viscous increment onto the capstan's convex
 * force cone. Since the elastic base is already in that cone, projection
 * gives (Tnew−Tbase)·lengthRate >=0: the added force can only dissipate work.
 * This is rope viscosity, not a new stored reserve or a static brake. */
export function dampRoom35CapstanTensions(base,leftRate,rightRate,viscosity=25){
 const E=base.ratio,a=base.leftTension,b=base.rightTension;
 if(a<=1e-10||b<=1e-10)return {leftTension:a,rightTension:b,dissipationRate:0};
 const y=[a+viscosity*leftRate,b+viscosity*rightRate],candidates=[[0,0]];
 if(y[0]>=0&&y[1]>=0&&y[0]<=E*y[1]&&y[1]<=E*y[0])candidates.push(y);
 for(const n of [[E,1],[1,E]]){const t=Math.max(0,(y[0]*n[0]+y[1]*n[1])/(1+E*E));candidates.push([t*n[0],t*n[1]]);}
 candidates.sort((u,v)=>(u[0]-y[0])**2+(u[1]-y[1])**2-((v[0]-y[0])**2+(v[1]-y[1])**2));
 const [leftTension,rightTension]=candidates[0],dissipationRate=(leftTension-a)*leftRate+(rightTension-b)*rightRate;
 if(dissipationRate< -1e-7)throw new Error('Projected rope viscosity would create work');
 return {leftTension,rightTension,dissipationRate:Math.max(0,dissipationRate)};
}
