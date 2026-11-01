// Static pigment on existing observatory walking skins and roof undersides.
// This module creates GLSL strings only: no meshes, textures, clocks or owners.
export const OBSERVATORY_FIELD_REVISION='observatory-static-field-compositions-v2-shared-floor';
const PROFILES={
 "31": {
  "name": "freight gantry courts",
  "floor": {
   "height": [
    -4.05,
    0.05
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -29,
      4,
      -6,
      12
     ],
     "tone": [
      0.83,
      0.94,
      0.98
     ]
    },
    {
     "shape": "rect",
     "p": [
      -13,
      12,
      12,
      20
     ],
     "tone": [
      0.92,
      0.96,
      0.99
     ]
    },
    {
     "shape": "rect",
     "p": [
      -29,
      13,
      -13,
      26
     ],
     "tone": [
      1.02,
      0.97,
      0.9
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.42,
    0.46,
    0.54
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -28,
      3,
      28,
      12
     ],
     "tone": [
      0.63,
      0.68,
      0.73
     ]
    },
    {
     "shape": "rect",
     "p": [
      -28,
      -25,
      27,
      -15
     ],
     "tone": [
      0.55,
      0.62,
      0.7
     ]
    },
    {
     "shape": "rect",
     "p": [
      -25,
      -13,
      -9,
      0
     ],
     "tone": [
      0.46,
      0.53,
      0.61
     ]
    }
   ]
  }
 },
 "32": {
  "name": "offset optical benches",
  "floor": {
   "height": [
    -0.05,
    0.05
   ],
   "regions": [
    {
     "shape": "round",
     "p": [
      8,
      10,
      21,
      22,
      1.2
     ],
     "tone": [
      1.02,
      0.91,
      0.96
     ]
    },
    {
     "shape": "round",
     "p": [
      -23,
      -5,
      -12,
      5,
      1.0
     ],
     "tone": [
      0.88,
      0.94,
      1.01
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.42,
    0.4,
    0.49
   ],
   "regions": [
    {
     "shape": "round",
     "p": [
      5,
      6,
      22,
      22,
      2.0
     ],
     "tone": [
      0.66,
      0.58,
      0.68
     ]
    },
    {
     "shape": "round",
     "p": [
      -23,
      -12,
      -8,
      6,
      1.6
     ],
     "tone": [
      0.51,
      0.59,
      0.7
     ]
    }
   ]
  }
 },
 "33": {
  "name": "hydraulic return court",
  "floor": {
   "height": [
    -0.05,
    0.05
   ],
   "regions": [
    {
     "shape": "capsule",
     "p": [
      -5,
      4.5,
      5,
      4.5,
      4.5
     ],
     "tone": [
      0.83,
      0.97,
      0.98
     ]
    },
    {
     "shape": "rect",
     "p": [
      -22,
      -25,
      -13,
      -9
     ],
     "tone": [
      0.93,
      0.98,
      1.01
     ]
    }
   ],
   "cutouts": [
    {
     "shape": "rect",
     "p": [
      -8.1,
      -0.1,
      4.1,
      12.1
     ]
    }
   ]
  },
  "roof": {
   "base": [
    0.42,
    0.46,
    0.54
   ],
   "regions": [
    {
     "shape": "round",
     "p": [
      -25,
      -26,
      -6,
      11,
      3.0
     ],
     "tone": [
      0.48,
      0.65,
      0.68
     ]
    },
    {
     "shape": "rect",
     "p": [
      8,
      -25,
      26,
      -10
     ],
     "tone": [
      0.57,
      0.62,
      0.69
     ]
    }
   ]
  }
 },
 "34": {
  "name": "chamfered pressure aprons",
  "floor": {
   "height": [
    -0.05,
    0.05
   ],
   "regions": [
    {
     "shape": "chamfer",
     "p": [
      6,
      -3,
      24,
      22,
      2.2
     ],
     "tone": [
      1.04,
      0.96,
      0.87
     ]
    },
    {
     "shape": "round",
     "p": [
      -12,
      -6,
      6,
      11,
      1.4
     ],
     "tone": [
      0.94,
      0.91,
      0.88
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.45,
    0.42,
    0.45
   ],
   "regions": [
    {
     "shape": "chamfer",
     "p": [
      -17,
      -7,
      1,
      13,
      3.0
     ],
     "tone": [
      0.69,
      0.59,
      0.54
     ]
    }
   ]
  }
 },
 "36": {
  "name": "finite rotor sweep",
  "floor": {
   "height": [
    -4.05,
    -3.95
   ],
   "regions": [
    {
     "shape": "sweep",
     "p": [
      -8,
      -5,
      3,
      12
     ],
     "tone": [
      0.9,
      0.91,
      1.02
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.4,
    0.42,
    0.53
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -28,
      -22,
      -6,
      2
     ],
     "tone": [
      0.58,
      0.6,
      0.73
     ]
    },
    {
     "shape": "sweep",
     "p": [
      -8,
      -5,
      4,
      15
     ],
     "tone": [
      0.49,
      0.54,
      0.68
     ]
    }
   ]
  }
 },
 "37": {
  "name": "external magnetic service courts",
  "floor": {
   "height": [
    -0.05,
    0.05
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -22,
      -9,
      -19,
      6
     ],
     "tone": [
      0.87,
      0.98,
      0.93
     ]
    },
    {
     "shape": "rect",
     "p": [
      -13,
      -11.8,
      12,
      -9
     ],
     "tone": [
      0.91,
      0.97,
      0.91
     ]
    },
    {
     "shape": "rect",
     "p": [
      19,
      -19,
      22,
      -6
     ],
     "tone": [
      0.94,
      0.98,
      0.88
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.39,
    0.47,
    0.45
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -21,
      -7,
      -11,
      7
     ],
     "tone": [
      0.51,
      0.64,
      0.57
     ]
    },
    {
     "shape": "rect",
     "p": [
      -15,
      -10,
      15,
      -2
     ],
     "tone": [
      0.58,
      0.66,
      0.56
     ]
    },
    {
     "shape": "rect",
     "p": [
      11,
      -20,
      21,
      -7
     ],
     "tone": [
      0.48,
      0.59,
      0.54
     ]
    }
   ]
  }
 },
 "38": {
  "name": "separate freight and flight fields",
  "floor": {
   "height": [
    -4.05,
    -3.95
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -12,
      -25,
      -4,
      7
     ],
     "tone": [
      0.85,
      0.95,
      1.02
     ]
    },
    {
     "shape": "rect",
     "p": [
      -3,
      -9,
      4,
      7
     ],
     "tone": [
      0.94,
      0.98,
      1.01
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.39,
    0.45,
    0.54
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -4,
      -12,
      24,
      -5
     ],
     "tone": [
      0.54,
      0.64,
      0.73
     ]
    },
    {
     "shape": "rect",
     "p": [
      1,
      2,
      24,
      9
     ],
     "tone": [
      0.61,
      0.68,
      0.73
     ]
    }
   ]
  }
 },
 "39": {
  "name": "three thermal compartments",
  "floor": {
   "height": [
    -0.05,
    0.05
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -26,
      4.5,
      26,
      26
     ],
     "tone": [
      1.04,
      0.92,
      0.83
     ]
    },
    {
     "shape": "rect",
     "p": [
      -26,
      -9.5,
      26,
      3.5
     ],
     "tone": [
      0.95,
      0.97,
      1.0
     ]
    },
    {
     "shape": "rect",
     "p": [
      -26,
      -26,
      26,
      -10.5
     ],
     "tone": [
      0.85,
      0.95,
      1.03
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.38,
    0.41,
    0.47
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -26,
      4.5,
      26,
      25
     ],
     "tone": [
      0.69,
      0.58,
      0.5
     ]
    },
    {
     "shape": "rect",
     "p": [
      -26,
      -9.5,
      26,
      3.5
     ],
     "tone": [
      0.54,
      0.6,
      0.67
     ]
    },
    {
     "shape": "rect",
     "p": [
      -26,
      -25,
      26,
      -10.5
     ],
     "tone": [
      0.48,
      0.58,
      0.65
     ]
    }
   ]
  }
 },
 "40": {
  "name": "orthogonal calibration bed",
  "floor": {
   "height": [
    -0.05,
    0.05
   ],
   "regions": [
    {
     "shape": "round",
     "p": [
      -12.5,
      -8.5,
      12.5,
      10.5,
      1.2
     ],
     "tone": [
      0.94,
      0.98,
      0.88
     ]
    },
    {
     "shape": "round",
     "p": [
      -23,
      11,
      -11,
      23,
      0.8
     ],
     "tone": [
      1.02,
      0.98,
      0.87
     ]
    }
   ],
   "cutouts": []
  },
  "roof": {
   "base": [
    0.43,
    0.48,
    0.44
   ],
   "regions": [
    {
     "shape": "rect",
     "p": [
      -6,
      -15,
      6,
      14
     ],
     "tone": [
      0.61,
      0.65,
      0.57
     ]
    },
    {
     "shape": "rect",
     "p": [
      -21,
      -8,
      21,
      5
     ],
     "tone": [
      0.57,
      0.63,
      0.56
     ]
    },
    {
     "shape": "round",
     "p": [
      -25,
      12,
      -10,
      23,
      1.5
     ],
     "tone": [
      0.67,
      0.65,
      0.54
     ]
    }
   ]
  }
 }
};

export const OBSERVATORY_FIELD_GLSL=`
 float opticsFieldCoverage(float distanceToEdge){
  float aa=max(fwidth(distanceToEdge),.025);
  return 1.0-smoothstep(-aa,aa,distanceToEdge);
 }
 float opticsFieldOutside(float distanceToCutout){
  float aa=max(fwidth(distanceToCutout),.025);
  return smoothstep(0.0,aa,distanceToCutout);
 }
 float opticsFieldBox(vec2 p,vec2 center,vec2 halfSize){
  vec2 q=abs(p-center)-halfSize;
  return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0);
 }
 float opticsFieldRound(vec2 p,vec2 center,vec2 halfSize,float radius){
  vec2 q=abs(p-center)-halfSize+vec2(radius);
  return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;
 }
 float opticsFieldChamfer(vec2 p,vec2 center,vec2 halfSize,float cut){
  vec2 q=abs(p-center);
  return max(opticsFieldBox(p,center,halfSize),(q.x+q.y-halfSize.x-halfSize.y+cut)*.70710678);
 }
 float opticsFieldCapsule(vec2 p,vec2 a,vec2 b,float radius){
  vec2 pa=p-a,ba=b-a;
  return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0))-radius;
 }
 float opticsFieldSweep(vec2 p,vec2 center,float innerRadius,float outerRadius){
  vec2 q=p-center;float radius=length(q);
  return max(max(radius-outerRadius,innerRadius-radius),max(-q.x,-q.y));
 }
`;
const number=value=>{
 if(!Number.isFinite(value))throw new Error('Nonfinite observatory field coordinate');
 return value.toFixed(4);
};
const vec=values=>'vec'+values.length+'('+values.map(number).join(',')+')';
function distance(region){
 const p=region.p;
 if(region.shape==='capsule')return `opticsFieldCapsule(opticsFieldP,${vec(p.slice(0,2))},${vec(p.slice(2,4))},${number(p[4])})`;
 if(region.shape==='sweep')return `opticsFieldSweep(opticsFieldP,${vec(p.slice(0,2))},${number(p[2])},${number(p[3])})`;
 const center=vec([(p[0]+p[2])/2,(p[1]+p[3])/2]),half=vec([(p[2]-p[0])/2,(p[3]-p[1])/2]);
 if(region.shape==='rect')return `opticsFieldBox(opticsFieldP,${center},${half})`;
 if(region.shape==='round')return `opticsFieldRound(opticsFieldP,${center},${half},${number(p[4])})`;
 if(region.shape==='chamfer')return `opticsFieldChamfer(opticsFieldP,${center},${half},${number(p[4])})`;
 throw new Error('Unknown observatory field shape');
}
function surfaceFinish(surface,floor){
 const allowed=surface.cutouts?.length?surface.cutouts.map(region=>`opticsFieldOutside(${distance(region)})`).join('*'):'1.0';
 const body=`vec2 opticsFieldP=vOpticsWorld.xz;
vec3 opticsFieldTone=${vec(surface.base??[1,1,1])};
float opticsFieldAllowed=${allowed};
`+
  surface.regions.map(region=>`opticsFieldTone=mix(opticsFieldTone,${vec(region.tone)},opticsFieldCoverage(${distance(region)})*opticsFieldAllowed);`).join('\n')+
  '\ndiffuseColor.rgb*=opticsFieldTone;';
 return floor?`if(normalize(vOpticsNormal).y>.98 && vOpticsWorld.y>=${number(surface.height[0])} && vOpticsWorld.y<=${number(surface.height[1])}){
${body}
}`:body;
}
export function observatoryFieldFinish(stable){
 const profile=PROFILES[stable];if(!profile)return null; // 35 deliberately retains its complete prior finish.
 const regions=profile.floor.regions.length+(profile.floor.cutouts?.length??0)+profile.roof.regions.length;
 if(regions>6)throw new Error('Observatory field composition exceeds six broad regions');
 return Object.freeze({name:profile.name,regions,floor:surfaceFinish(profile.floor,true),roof:surfaceFinish(profile.roof,false),
  floorHeight:Object.freeze([...profile.floor.height]),floorCutouts:Object.freeze(profile.floor.cutouts.map(region=>Object.freeze({shape:region.shape,p:Object.freeze([...region.p])})))});
}
