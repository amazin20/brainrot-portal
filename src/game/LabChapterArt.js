import * as THREE from 'three';

// Each chapter has one dominant construction colour, one complementary family,
// warm walking decks and a dark coloured frame. Ivory belongs to portals only.
export const CHAPTER_VISUAL_PROFILES=Object.freeze({
 garden:Object.freeze({id:'garden',title:'Поворотный сад',wall:0xf18a79,secondary:0x70c6ad,low:0xd5b98b,high:0x5bafa2,trim:0x286c74,ceiling:0xeacb91,edge:0xf4d568,sky:0x9bd8e9,fill:0xffedcd}),
 carnival:Object.freeze({id:'carnival',title:'Кинетический карнавал',wall:0xdc6f99,secondary:0x44c4c6,low:0xddc68e,high:0xd58c75,trim:0x31578f,ceiling:0xe7ce9d,edge:0xffdf79,sky:0xa6deed,fill:0xffe9cf}),
 lagoon:Object.freeze({id:'lagoon',title:'Обсерватория приливов',wall:0x62c9bf,secondary:0xe89179,low:0x8cb8cb,high:0x499eae,trim:0x285c90,ceiling:0xa8d3d8,edge:0xe0e796,sky:0x9dd8ee,fill:0xffefd4}),
 inversion:Object.freeze({id:'inversion',title:'Перевёрнутый сад',wall:0xa58bd5,secondary:0x657dce,low:0xbba5cc,high:0xd7be67,trim:0x4c4b85,ceiling:0xc3b1de,edge:0xe6dd77,sky:0xc3c2eb,fill:0xffedd8}),
 launch:Object.freeze({id:'launch',title:'Парк запуска',wall:0xed946c,secondary:0x5d8fd5,low:0xcebd92,high:0x60b4c1,trim:0x315c98,ceiling:0xbed9dc,edge:0xffdc6b,sky:0xa0dbf0,fill:0xffedce}),
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
