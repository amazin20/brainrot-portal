import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const config=JSON.parse(fs.readFileSync('tools/singularity-preview-release.json','utf8'));
assert.ok(['demo','complete'].includes(config.mode));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const site=path.resolve('site'),target=path.join(site,'tower-singularity');
function files(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(root,e.name)):[path.join(root,e.name)]);}
const prior=read(path.join(site,'build-info.json'));
assert.equal(prior.commit,config.baseCommit,'The original public campaign must have the pinned provenance');
const originals=new Map(files(site).filter(p=>!p.startsWith(target+path.sep)).map(p=>[path.relative(site,p),hash(p)]));
const info=read('candidate/build-info.json');
assert.equal(info.commit,config.sourceCommit);assert.equal(info.run,String(config.candidateRun));
assert.equal(info.version,'v45-singularity');assert.equal(info.levels,41);
assert.equal(info.features.tower.stages,13);assert.equal(info.features.tower.checkpoints,false);
const native=read('proof/singularity-route/evidence.json');
function validate(e){
 assert.equal(e.sourceCommit,config.sourceCommit);assert.equal(e.result.pass,true);
 assert.equal(e.result.metrics.completedStages,13);assert.equal(e.observed.events.length,13);
 assert.equal(new Set(e.observed.events.map(x=>x.id)).size,13);
 assert.equal(new Set(e.observed.events.map(x=>x.rule)).size,13);
 assert.equal(e.result.resets+e.result.respawns+e.result.cargoResets,0);
 assert.equal(e.result.sameCompanion,true);assert.equal(e.result.metrics.checkpoints,false);
 assert.ok(e.result.activeSeconds>=900);assert.deepEqual(e.errors,[]);
}
validate(native);
fs.rmSync(target,{recursive:true,force:true});fs.cpSync('candidate',target,{recursive:true});
fs.mkdirSync(path.join(target,'media'),{recursive:true});
fs.copyFileSync('proof/singularity-inspection/ordinary-start.png',path.join(target,'media','tower-preview.png'));
fs.copyFileSync('proof/singularity-route/evidence.json',path.join(target,'native-evidence.json'));
let video=null,evidence=native;
if(config.mode==='complete'){
 evidence=read('proof/singularity-recording/evidence.json');validate(evidence);
 const v=evidence.video;assert.ok(v&&v.frames>0);assert.equal(v.first.state,'playing');assert.deepEqual(v.first.solved,[]);assert.equal(v.last.state,'won');
 const movie='proof/singularity-recording/'+v.filename;
 assert.equal(hash(movie),v.sha256);
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8'}));
 const stream=metadata.streams.find(s=>s.codec_type==='video');assert.equal(stream.codec_name,'h264');
 assert.equal(stream.width,v.width);assert.equal(stream.height,v.height);assert.equal(Number(stream.nb_frames),v.frames);
 assert.ok(Math.abs(Number(metadata.format.duration)-v.durationSeconds)<.12);assert.ok(v.durationSeconds>=900);
 fs.copyFileSync(movie,path.join(target,'media','tower-singularity.mp4'));
 fs.copyFileSync('proof/singularity-recording/evidence.json',path.join(target,'recording-evidence.json'));
 fs.copyFileSync('proof/singularity-recording/gameplay-start.jpg',path.join(target,'media','tower-poster.jpg'));
 video={...v,filename:'media/tower-singularity.mp4',bytes:fs.statSync(movie).size};
}
const release={sourceCommit:config.sourceCommit,candidateRun:config.candidateRun,publicationRun:process.env.GITHUB_RUN_ID||null,
 mode:config.mode,baseCommit:config.baseCommit,preservedCampaignFiles:originals.size,nativeRouteVerified:true,
 video,seconds:evidence.result.seconds,activeSeconds:evidence.result.activeSeconds,
 completedMachines:13,resets:0,checkpoints:false,
 method:'Ordinary scripted production-physics route. No human speedrun or universal minimum-time claim.'};
fs.writeFileSync(path.join(target,'preview-release.json'),JSON.stringify(release,null,2)+'\n');
const names={orrery:'Орбитальная обсерватория',drydock:'Сухой док',optics:'Призменный карьер',reservoir:'Гидроархив',echo:'Память движения',magnet:'Магнитная подкова',transmission:'Зал трансмиссии',accumulator:'Последний заряд',parallax:'Параллаксный шлюз',archive:'Сдвигающийся архив',migrant:'Мигрирующая апертура',inertia:'Разлом инерции',inversion:'Камера инверсии'};
const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const chapters=evidence.result.milestones.filter(m=>m.name.startsWith('Start ')).map(m=>({name:names[m.name.slice(6)]||m.name,seconds:m.seconds}));
const title='Башня Сингулярности';
const media=video?`<video id="walkthrough" controls playsinline preload="metadata" poster="media/tower-poster.jpg" src="media/tower-singularity.mp4"></video><div class="chapters">${chapters.map(c=>`<button data-seek="${c.seconds}"><span>${clock(c.seconds)}</span> ${c.name}</button>`).join('')}</div><p><a href="media/tower-singularity.mp4">Открыть MP4 отдельно</a> · <a href="recording-evidence.json">Отчёт записи</a></p>`:`<img class="preview" src="media/tower-preview.png" alt="Реальный кадр новой башни"><p class="notice">Эта страница содержит проверенную игровую демку. Полный MP4 пока не опубликован.</p>`;
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — новая демка</title><style>
*{box-sizing:border-box}body{margin:0;background:#0e1c27;color:#e8f0ef;font:17px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:48px 24px}small{color:#77d9ca;letter-spacing:.12em}h1{font-size:clamp(32px,5vw,56px);line-height:1.1;margin:18px 0}h2{font-size:26px}p{max-width:880px;color:#b7ccd4}.lead{font-size:20px}.actions{display:flex;gap:16px;flex-wrap:wrap;margin:28px 0}.primary{display:inline-block;background:#86e2cf;color:#0c2730!important;border-radius:12px;padding:14px 22px;font-weight:750;text-decoration:none}a{color:#8debdc}video,.preview{width:100%;display:block;border-radius:18px;border:1px solid #385664;background:#061017;margin-top:28px}.stats{display:flex;gap:24px;flex-wrap:wrap;padding:22px 0;border-top:1px solid #304957;border-bottom:1px solid #304957}.stats strong{font-size:28px;display:block}.stats div{min-width:145px;color:#b7ccd4}.chapters{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:9px;margin:20px 0}.chapters button{font:inherit;font-size:14px;text-align:left;border:1px solid #355463;background:#172f3c;color:#eaf1ef;padding:12px;border-radius:9px;cursor:pointer}.chapters span{color:#8debdc;display:block;font-weight:700}.notice{padding:16px 20px;background:#19313c;border-left:3px solid #88dcce;border-radius:8px}footer{font-size:13px;color:#8faab6;margin-top:42px;overflow-wrap:anywhere}
</style><main><small>БРЕЙНРОТ ПОРТАЛ / НОВЫЙ УРОВЕНЬ 41</small><h1>${title}</h1><p class="lead">Единый машинный собор вместо одинаковых этажных крыльев. Тринадцать разных задач, девять самостоятельных залов и связанные верхние маршруты. Без контрольных точек.</p><div class="actions"><a class="primary" href="./?edition=foundation&level=41">Играть в новую башню</a><a href="../">Основная кампания</a></div><div class="stats"><div><strong>13</strong>разных правил</div><div><strong>9</strong>залов в свободном порядке</div><div><strong>${clock(evidence.result.seconds)}</strong>измеренное прохождение</div><div><strong>0</strong>сбросов попытки</div></div>${media}<h2>Здесь меняется способ решения</h2><p>Связанные орбиты, грузовой док, отражённый луч, сохранение объёма воды, запись движения, магнитная доставка, инерционная трансмиссия, затухающий заряд, параллакс, подвижные стены, портальная каретка, полёт из падения и инверсия ускорения.</p><p class="notice">Время относится к автоматическому маршруту с обычными игровыми действиями и настоящей физикой. Это не рекорд человека и не гарантия, что уровень невозможно пройти быстрее. ${video?'Видео записано непрерывно в масштабе 1×, 12 кадров/с, на экономичном графическом профиле.':'Производственная браузерная проверка достигла настоящей победы.'}</p><p><a href="native-evidence.json">Полный технический отчёт</a> · <a href="preview-release.json">Версия демки</a> · <a href="https://github.com/amazin20/brainrot-portal/tree/${config.sourceCommit}">Исходный коммит</a></p><footer>Коммит ${config.sourceCommit}<br>Демка размещена отдельно: файлы ранее опубликованной кампании сохранены побайтно.</footer></main><script>document.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>{const v=document.getElementById('walkthrough');v.currentTime=Number(b.dataset.seek);v.play().catch(()=>{});v.scrollIntoView({behavior:'smooth',block:'center'});}));</script></html>`;
fs.writeFileSync(path.join(target,'walkthrough.html'),html);
for(const [name,digest]of originals)assert.equal(hash(path.join(site,name)),digest,`Original campaign file changed: ${name}`);
fs.mkdirSync('publication-proof',{recursive:true});fs.writeFileSync('publication-proof/assembly.json',JSON.stringify(release,null,2)+'\n');
console.log('ISOLATED PREVIEW ASSEMBLED',JSON.stringify(release));
