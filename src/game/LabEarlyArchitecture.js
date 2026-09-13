// Early chambers retain their cool/warm identity within the same coated-metal
// architectural kit used by the advanced campaign. Ivory remains exclusive
// to portal surfaces; elevated decks receive a restrained contrasting finish.
const PALETTES=[
 {wall:0x7d9193,low:0x8e9e9e,high:0xadb7ad,trim:0x4e666d,sky:0x3e515a},
 {wall:0x879487,low:0x949d8e,high:0xb8ac92,trim:0x596a5e,sky:0x435248},
 {wall:0x7c8c9d,low:0x929fab,high:0xaca99b,trim:0x4f657b,sky:0x3e4e64},
 {wall:0x938b82,low:0xa29a8d,high:0xb8ac95,trim:0x6b6256,sky:0x514b46},
 {wall:0x858f96,low:0x96a1a3,high:0xb9ac8e,trim:0x566a70,sky:0x414f5a},
 {wall:0x858b96,low:0x979faa,high:0xb3a68e,trim:0x596474,sky:0x424d5c},
 {wall:0x82948c,low:0x95a39a,high:0xb6b296,trim:0x516c62,sky:0x3e5349},
 {wall:0x7d919e,low:0x91a4ae,high:0xaab8b4,trim:0x4e687b,sky:0x3c5062},
 {wall:0x938b81,low:0xa49989,high:0xb9ae95,trim:0x6c6253,sky:0x514b41},
 {wall:0x858e9a,low:0x97a1ad,high:0xb4aca0,trim:0x586776,sky:0x434f61},
 {wall:0x80978f,low:0x95a89f,high:0xb0b6a2,trim:0x526e65,sky:0x3c554f},
];
export const earlyRoomPalette=index=>PALETTES[index];

export function architecturalCeiling(level,fallback=20){
 if(level.index>=11)return level.workshop?.ceiling??level.ceiling??fallback;
 const roof=level.world.surfaces.find(s=>s.normal.y<-.99&&s.name==='Non-portal ceiling tiles');
 return roof?roof.getFrame().center.y-.34:level.workshop?.ceiling??level.ceiling??fallback;
}
