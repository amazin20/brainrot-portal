import * as THREE from 'three';

// Each chapter uses broad enamel fields against warm mineral decks. The dark
// structural frame separates silhouettes; ivory remains exclusive to portals.
export const CHAPTER_VISUAL_PROFILES=Object.freeze({
 garden:Object.freeze({id:'garden',title:'Поворотный сад',wall:0xc6a993,secondary:0x5f9e90,low:0xabb8ae,high:0x7eaa9d,trim:0x2c4953,ceiling:0xb8b5a5,edge:0xf3c272,sky:0x2a414d,fill:0xffe9cb}),
 carnival:Object.freeze({id:'carnival',title:'Кинетический карнавал',wall:0xb98e9e,secondary:0x5c99a2,low:0xb6ad9a,high:0xb27f76,trim:0x34475b,ceiling:0xbbb2ae,edge:0xf7c779,sky:0x303e4d,fill:0xffe4d0}),
 lagoon:Object.freeze({id:'lagoon',title:'Обсерватория приливов',wall:0x80afb0,secondary:0xbb8b7a,low:0x95aebb,high:0x578f9a,trim:0x2a4c61,ceiling:0xa8b9b7,edge:0xebc87b,sky:0x294453,fill:0xffedce}),
 inversion:Object.freeze({id:'inversion',title:'Перевёрнутый сад',wall:0xa392b5,secondary:0x7286b4,low:0xaea6b1,high:0xb6a473,trim:0x3a3d61,ceiling:0xb1a6bd,edge:0xe9d17f,sky:0x353a51,fill:0xffe7d1}),
 launch:Object.freeze({id:'launch',title:'Парк запуска',wall:0xbf907b,secondary:0x6a95b5,low:0xb7ac9c,high:0x71a6aa,trim:0x304e65,ceiling:0xabb9bb,edge:0xf4c66f,sky:0x2a4352,fill:0xffe7c8}),
});

export function getChapterVisualProfile(levelOrWorld){
 const world=levelOrWorld?.world??levelOrWorld;
 const value=levelOrWorld?.visualProfile??world?.visualProfile;
 const id=typeof value==='string'?value:value?.id;
 return CHAPTER_VISUAL_PROFILES[id]??null;
}

/** Call immediately after constructing Workshop, before its first shell. The
 * opt-in open sky is authored topology for these new rooms, never a retrofit
 * that silently removes an existing chamber's roof or collision. */
export function configureChapterWorld(world,id,{openSky=false}={}){
 const profile=CHAPTER_VISUAL_PROFILES[id];
 if(!profile)throw new RangeError(`Unknown chapter art profile: ${id}`);
 if(world.surfaces.length)throw new Error('Configure chapter art before building the room shell');
 world.visualProfile=Object.freeze({id,openSky:Boolean(openSky)});
 Object.assign(world.palette,{wall:profile.wall,floor:profile.low,sky:profile.sky,accent:profile.edge});
 for(const [key,color] of [['wall',profile.wall],['floor',profile.low],['trim',profile.trim],['accent',profile.edge],['lamp',profile.edge]])world.materials[key]?.color.setHex(color);
 world.root.userData.chapterVisualProfile=id;
 return world.visualProfile;
}

export function keepsAuthoredMaterial(node){
 for(let current=node;current;current=current.parent)if(current.userData?.keepMaterial===true)return true;
 return false;
}

/** The building itself carries the colour, in entire wall bays and platforms.
 * Orientation splits the two wall families; authored roles override that rule.
 * No random per-tile rainbow or tiny stripe has to carry the chapter identity. */
export function chapterSurfaceColor(profile,{kind='wall',frame,role}={}){
 const selectedRole=role==='floor'?'low':role;
 if(selectedRole&&Number.isFinite(profile[selectedRole]))return profile[selectedRole];
 if(kind==='floor')return frame?.center.y>4?profile.high:profile.low;
 if(kind==='ceiling')return profile.ceiling;
 return Math.abs(frame?.normal.x??0)>.65?profile.secondary:profile.wall;
}

/** Runs after the ordinary art passes and before static batching. Those passes
 * already consume this profile; this hook records the contract and finishes
 * the existing scene, without a second skin, new lights or per-frame work. */
export function finishChapterArt(level){
 const profile=getChapterVisualProfile(level);
 if(!profile||level.chapterArt)return level;
 const world=level.world,game=level.game??world.game;
 game.scene.background=new THREE.Color(profile.sky);
 if(game.scene.fog){
  game.scene.fog.color.setHex(profile.sky);
  game.scene.fog.near=profile.id==='launch'?180:64;
  game.scene.fog.far=profile.id==='launch'?420:120;
 }
 world.materials.ceramic.color.setHex(0xf4f1e8);
 level.chapterArt=Object.freeze({profile:profile.id,openSky:world.visualProfile?.openSky===true,dominant:profile.wall,secondary:profile.secondary,portalCeramic:0xf4f1e8,extraLights:0,perFrameCallbacks:0});
 world.root.userData.chapterArt=level.chapterArt;
 return level;
}
