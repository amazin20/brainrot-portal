/** One shared, zero-based chapter registry for rooms, menu and loading.
 * Numbering and save IDs do not change. A shared theme is not a shared puzzle. */
export const CAMPAIGN_THEMES=Object.freeze([
 {id:'discovery',from:0,to:9,name:'Лаборатория открытия',short:'Открытие',subtitle:'Светлая керамика · лазурь · первые эксперименты',color:'#67e2f0',symbol:'01',wall:0xc3d9de,floor:0x91afb7,shell:0xe1eef0,paint:0x327f93,dark:0x253f53,service:0x6e8792,sky:0x526f83,key:0xfff1db,fill:0xbceafb},
 {id:'dynamo',from:10,to:19,name:'Медный энергоблок',short:'Энергоблок',subtitle:'Медь · тёплая эмаль · передача энергии',color:'#ffc184',symbol:'02',wall:0xd8c4ac,floor:0x9a8770,shell:0xe9d7b9,paint:0xa7643d,dark:0x354846,service:0x77796c,sky:0x605b52,key:0xffdfb1,fill:0xcee4da},
 {id:'biosphere',from:20,to:29,name:'Биосфера',short:'Биосфера',subtitle:'Нефрит · известняк · живая архитектура',color:'#a4edbc',symbol:'03',wall:0xc4d6bd,floor:0x8ea390,shell:0xe5ead3,paint:0x437b62,dark:0x294c46,service:0x6d887e,sky:0x496e66,key:0xffefcb,fill:0xc5f0e3},
 {id:'observatory',from:30,to:39,name:'Ночная обсерватория',short:'Обсерватория',subtitle:'Индиго · серебро · точные системы',color:'#b2b8ff',symbol:'04',wall:0x909ebc,floor:0x687d9c,shell:0xc7d4e5,paint:0x6368aa,dark:0x283552,service:0x596f89,sky:0x354b70,key:0xece4ff,fill:0xb3e5ff},
 {id:'fracture',from:40,to:49,name:'Золотой разлом',short:'Разлом',subtitle:'Минералы · золото · сложные пространства',color:'#ffdb8e',symbol:'05',wall:0xc8b9a8,floor:0x968678,shell:0xe7d8c1,paint:0x957241,dark:0x4b4357,service:0x827983,sky:0x675765,key:0xffe6bf,fill:0xddd2f7},
 {id:'horizon',from:50,to:50,name:'За горизонтом',short:'Эпилог',subtitle:'Перламутр · бирюза · последний адрес',color:'#b0f1eb',symbol:'∞',wall:0xd6e4e5,floor:0x9cbab9,shell:0xedf3ef,paint:0x4b9d9c,dark:0x385666,service:0x829c9f,sky:0x718999,key:0xfff4df,fill:0xbff6f1},
].map(theme=>Object.freeze(theme)));
export function campaignTheme(index){
 if(!Number.isInteger(index)||index<0||index>50)throw new RangeError('Unknown foundation room');
 return CAMPAIGN_THEMES.find(theme=>index>=theme.from&&index<=theme.to);
}
