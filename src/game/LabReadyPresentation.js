/** Present the actual menu before announcing readiness to the host platform.
 * Frames are counted only while the menu is fully opaque. Loading-screen
 * first paint is deliberately insufficient, and no fixed delay is used. */
export async function waitForMenuPaint({panel,document=globalThis.document,
  requestFrame=globalThis.requestAnimationFrame,getStyle=globalThis.getComputedStyle,
  createImage=()=>new Image(),isCurrent=()=>true}={}) {
  await document.fonts?.ready;
  if(!isCurrent())return false;
  const background=getStyle(panel).backgroundImage||'';
  const urls=[...background.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(match=>match[1]);
  await Promise.all(urls.map(async url=>{const image=createImage();image.src=url;await image.decode();}));
  let paintedFrames=0;
  while(paintedFrames<2){
    await new Promise(resolve=>requestFrame(resolve));
    if(!isCurrent())return false;
    const style=getStyle(panel);
    const entering=(panel.getAnimations?.({subtree:true})||[]).some(animation=>
      !['finished','idle'].includes(animation.playState)&&Number.isFinite(animation.effect?.getComputedTiming().endTime));
    const visible=!entering&&style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)===1&&panel.getClientRects().length>0;
    paintedFrames=visible?paintedFrames+1:0;
  }
  return true;
}

export class LabStartupError extends Error {
  constructor(kind,cause){super('Game startup failed',{cause});this.name='LabStartupError';this.kind=kind;}
}
export function startupFailureMessage(error){
  if(error instanceof LabStartupError&&error.kind==='graphics')return 'Не удалось подготовить 3D-сцену. Нажми «Повторить загрузку». Сохранённый прогресс комнат не изменён.';
  if(error instanceof LabStartupError&&error.kind==='sdk')return 'Не удалось подключиться к Яндекс Играм. Проверь соединение и нажми «Повторить загрузку». Сохранённый прогресс комнат не изменён.';
  return 'Не удалось запустить игру. Нажми «Повторить загрузку». Сохранённый прогресс комнат не изменён.';
}
