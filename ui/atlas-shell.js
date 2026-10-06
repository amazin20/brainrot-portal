import { $, $$, start, reduced, ranges, sectorNames, sector, icon, node, button, cleanup, listen } from './atlas-common.js';
import { installControls } from './atlas-controls.js';
import { installMap } from './atlas-map.js';
export function mount() {
 const map = $('#campaign-map'), nodes = $('.sector-nodes', map), tabs = $('.sector-tabs', map);
 const select = $('#level-select'), hero = $('.hero-panel', start);
 if (!nodes?.children.length || !tabs?.children.length || !hero || document.documentElement.dataset.runtimeState !== 'ready') return false;
 const title = $('#game-title'), lead = $('.lead', hero), actions = $('.start-actions', hero), selected = $('.selected-room', actions);
 const play = $('#play-button'), settingsPanel = $('.settings-panel'), controls = $('.controls-disclosure', hero);
 const index = $('.hero-index', hero), campaignCount = $('#campaign-count');
 if (!title || !actions || !play || !settingsPanel) return false;
 const header = node('header', 'atlas-header');
 header.append(node('div', 'atlas-wordmark', `${icon('portal')}<span>ЛАБОРАТОРИЯ<br><strong>ПРОСТРАНСТВА</strong></span>`));
 header.append(node('div', 'atlas-system', '<i></i> ПОРТАЛЬНАЯ СВЯЗЬ УСТАНОВЛЕНА'));
 const headerTools = node('div', 'atlas-header-tools');
 const sound = button('atlas-icon', icon('sound'), 'Выключить звук');
 const settingsTop = button('atlas-icon', icon('settings'), 'Открыть настройки');
 headerTools.append(sound, settingsTop); header.append(headerTools);
 const nav = node('aside', 'atlas-nav');
 nav.append(node('p', 'atlas-eyebrow', 'ИССЛЕДУЙ. СОЕДИНЯЙ. УДИВЛЯЙСЯ.'), title, lead);
 const navlinks = node('nav', 'atlas-links'); navlinks.setAttribute('aria-label', 'Основное меню');
 const mapButton = button('atlas-nav-button is-active', `${icon('map')}<span>Кампания<small>Карта испытаний</small></span><b>↗</b>`, 'Карта испытаний');
 const settingsButton = button('atlas-nav-button', `${icon('settings')}<span>Настройки</span>`, 'Настройки игры');
 const helpButton = button('atlas-nav-button', `${icon('help')}<span>Как играть</span>`, 'Как играть');
 const gallery = node('a', 'atlas-nav-button', `${icon('gallery')}<span>Прохождения</span><b>↗</b>`);
 gallery.href = './walkthroughs.html'; gallery.setAttribute('aria-label','Галерея прохождений');
 navlinks.append(mapButton, gallery, settingsButton, helpButton); nav.append(navlinks);
 nav.append(node('div', 'atlas-nav-foot', `${icon('portal')}<span>Вместе — по обе<br>стороны портала.</span>`));
 const detail = node('aside', 'atlas-detail'); detail.setAttribute('aria-label', 'Выбранное испытание');
 const preview = node('figure', 'atlas-preview');
 const previewImg = node('img', 'atlas-preview-image'); previewImg.alt = ''; previewImg.width = 640; previewImg.height = 360; previewImg.decoding = 'async';
 const previewLabel = node('figcaption', '', '<span>ВНУТРИ ИСПЫТАНИЯ</span><b>↗</b>');
 preview.append(previewImg, previewLabel);
 const detailHeading = node('div', 'atlas-detail-heading', '<span>ВЫБРАННОЕ ИСПЫТАНИЕ</span><i></i>');
 const chapterLabel = node('p', 'atlas-detail-chapter');
 detail.append(detailHeading, preview, chapterLabel, actions);
 $('.walkthrough-link', actions)?.remove();
 // The native map synchronizer still updates this original element.
 if (index) { index.hidden = true; header.append(index); }
 const mapHead = $('.map-header', map);
 mapHead.replaceChildren(node('div', '', '<span class="atlas-eyebrow">АТЛАС ИСПЫТАНИЙ</span><h2 id="campaign-map-title">Твой следующий<br><em>невозможный</em> шаг.</h2>'));
 const atlasNav = node('div', 'atlas-map-navigation');
 const prev = button('atlas-icon', '←', 'Предыдущий сектор');
 const next = button('atlas-icon', '→', 'Следующий сектор');
 const count = node('span', 'atlas-sector-count'); atlasNav.append(prev, count, next);
 $('.sector-heading', map).append(atlasNav);
 const constellation = node('div', 'atlas-constellation');
 const paths = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
 paths.classList.add('atlas-paths'); paths.setAttribute('aria-hidden', 'true');
 nodes.before(constellation); constellation.append(paths, nodes);
 $('.map-footer', map).innerHTML = '<span><i></i> Все испытания доступны</span><span class="atlas-completed"></span>';
 const footer = node('footer', 'atlas-footer', '<span>СОХРАНЯЙ ИМПУЛЬС. НЕ ОСТАВЛЯЙ ДРУГА.</span><span class="atlas-keyboard-note">← → Выбор · Enter Подтвердить</span>');
 if (campaignCount) { campaignCount.className = 'atlas-campaign-count'; footer.prepend(campaignCount); }
 // Move, never clone, the actual Play button, selects and map buttons.
 start.replaceChildren(header, nav, map, detail, footer);
 start.classList.add('atlas-menu'); play.classList.add('atlas-play');
 selected.setAttribute('aria-live', 'polite'); selected.setAttribute('aria-atomic', 'true');
 const { closeDialog, syncSound } = installControls({settingsPanel,controls,sound,settingsTop,settingsButton,helpButton,mapButton,map,tabs});
 installMap({map,nodes,tabs,select,chapterLabel,count,previewLabel,previewImg,detail,prev,next,play,closeDialog,syncSound});
 return true;
}
