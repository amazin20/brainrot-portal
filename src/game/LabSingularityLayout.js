/** Hand-authored independent spaces. No modulo-selected recipes, replicated
 * wings, six identical hubs or ordinal stage locks. Dependencies cross space. */
export const SINGULARITY_ROOMS=Object.freeze([
 {id:'orrery',name:'ОРБИТАЛЬНАЯ ОБСЕРВАТОРИЯ',at:[-66,0,-40],w:46,d:42,h:17,entry:'e',color:'violet',requires:[],rule:'coupled-azimuth-bridges',hint:'Три привода связаны шестернями. Совмести реальные пролёты, затем пройди к телескопу.'},
 {id:'drydock',name:'СУХОЙ ДОК',at:[66,0,-36],w:46,d:54,h:18,entry:'w',color:'copper',requires:[],rule:'load-elevator-unload-from-above',hint:'Груз поднимает платформу. Верхний фиксатор сохраняет высоту, когда источник нагрузки исчезает.'},
 {id:'optics',name:'ПРИЗМЕННЫЙ КАРЬЕР',at:[0,0,-104],w:66,d:34,h:13,entry:'s',color:'cyan',requires:[],rule:'reflected-portal-ray',hint:'Проследи луч до конца. У зеркала два положения, а белые стены могут связать разорванную оптическую линию.'},
 {id:'reservoir',name:'ГИДРОАРХИВ',at:[-88,0,37],w:46,d:48,h:19,entry:'e',color:'mint',requires:[],rule:'conserved-eight-five-three',hint:'Ёмкости 8, 5 и 3. Раздели весь объём поровну между первыми двумя, не создавая и не теряя воду.'},
 {id:'echo',name:'ПАМЯТЬ ДВИЖЕНИЯ',at:[0,0,95],w:66,d:44,h:14,entry:'n',color:'rose',requires:[],rule:'recorded-spatial-coincidence',hint:'Запиши собственное движение. Эхо занимает только ту плиту, на которой ты действительно стоял.'},
 {id:'magnet',name:'МАГНИТНАЯ ПОДКОВА',at:[86,0,38],w:44,d:42,h:14,entry:'w',color:'cyan',requires:[],rule:'free-body-around-solid-baffle',hint:'Три магнитные катушки огибают экранирующую стену. Груз должен лететь свободно, а не оставаться на руках.'},
 {id:'transmission',name:'ЗАЛ ТРАНСМИССИИ',at:[-60,0,97],w:34,d:42,h:15,entry:'e',color:'copper',requires:[],rule:'flywheel-ratio-and-inertial-clutch',hint:'Передаточное отношение меняет скорость, но не запас энергии. Сначала раскрути маховик, затем подключи нагрузку.'},
 {id:'accumulator',name:'ПОСЛЕДНИЙ ЗАРЯД',at:[61,0,98],w:36,d:44,h:12,entry:'w',color:'violet',requires:[],rule:'decaying-charge-portal-shortcut',hint:'Плита заряжается только от путешественника. После схода запас тает; длинный обход съедает его целиком.'},
 {id:'archive',name:'СДВИГАЮЩИЙСЯ АРХИВ',at:[-12,14,-42],w:42,d:32,h:12,entry:'e',color:'rose',requires:['reservoir','echo'],rule:'reversible-spatial-permutation',hint:'Шкафы меняют сами проходы. Смотри, куда уезжает перегородка, а не только на ближайшую дверь.'},
 {id:'migrant',name:'МИГРИРУЮЩАЯ АПЕРТУРА',at:[42,27,10],w:34,d:46,h:14,entry:'w',color:'mint',requires:['drydock','transmission'],rule:'portal-on-translating-carriage',hint:'Портал остаётся на своей движущейся поверхности. Отправь выход туда, куда пешком не попасть.'},
 {id:'parallax',name:'ПАРАЛЛАКСНЫЙ ШЛЮЗ',at:[88,10,-95],w:44,d:40,h:16,entry:'w',color:'rose',requires:[],rule:'view-ray-through-displaced-apertures',hint:'Смотровая площадка и три разнесённые рамки образуют один визир. Переставь ближнюю и среднюю рамки и найди линию взгляда через все три отверстия.'},
 {id:'inertia',name:'РАЗЛОМ ИНЕРЦИИ',at:[0,42,-43],w:64,d:38,h:19,entry:'s',color:'cyan',requires:['orrery','optics','accumulator','parallax'],rule:'fall-energy-gap-crossing',hint:'Высота падения становится дальностью полёта. Принимающая площадка находится ниже выходного портала, за разрывом.'},
 {id:'inversion',name:'КАМЕРА ИНВЕРСИИ',at:[-42,55,4],w:34,d:42,h:20,highDoor:true,entry:'e',color:'violet',requires:['magnet','archive','migrant'],rule:'field-ascent-and-ceiling-exit',hint:'Поле меняет направление ускорения. Обычный прыжок запускает подъём; верхняя галерея держит тебя без поля.'},
].map(r=>Object.freeze({...r,at:Object.freeze(r.at),requires:Object.freeze(r.requires)})));
export const SINGULARITY_SPEC=Object.freeze({id:'tower-singularity',name:'БАШНЯ СИНГУЛЯРНОСТИ',title:'БАШНЯ СИНГУЛЯРНОСТИ',
 description:'Единый машинный собор: тринадцать разных задач, пересекающиеся пути и вершина над реактором. Решай нижние залы в любом порядке. Контрольных точек нет.',
 assets:[1,2,11],accent:0x70dbe5,hints:['Механизмы разных залов устроены по-разному. Их линии питания сходятся к верхним проходам.','У каждого зала собственные приборы, форма и правило. Брейнрот нужен в доке, магнитной камере и на вершине, но не для каждой задачи.','Белые керамические поверхности принимают порталы. Перезапуск сбрасывает весь комплекс.']});
export function validateSingularityLayout(rooms=SINGULARITY_ROOMS){
 const ids=new Set(rooms.map(r=>r.id));if(ids.size!==rooms.length)throw Error('Duplicated room');
 if(new Set(rooms.map(r=>r.rule)).size!==rooms.length)throw Error('Duplicated puzzle rule');
 const visiting=new Set(),visited=new Set();function walk(id){if(visiting.has(id))throw Error('Cyclic dependency');if(visited.has(id))return;const r=rooms.find(r=>r.id===id);if(!r)throw Error('Missing dependency '+id);visiting.add(id);r.requires.forEach(walk);visiting.delete(id);visited.add(id);}rooms.forEach(r=>walk(r.id));return true;
}
