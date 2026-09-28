(() => {
  'use strict';
  const TOTAL = 41;
  const entries = new Map();
  const nodes = {
    list: document.querySelector('#level-list'),
    count: document.querySelector('#ready-count'),
    index: document.querySelector('#watch-index'),
    title: document.querySelector('#watch-heading'),
    duration: document.querySelector('#duration'),
    video: document.querySelector('#video'),
    empty: document.querySelector('#player-empty'),
    emptyMessage: document.querySelector('#empty-message'),
    message: document.querySelector('#player-message'),
    play: document.querySelector('#play-level'),
    copy: document.querySelector('#copy-link'),
    next: document.querySelector('#next-level'),
  };
  const initial = Number(new URLSearchParams(location.search).get('level'));
  let selected = Number.isInteger(initial) && initial >= 1 && initial <= TOTAL ? initial : 1;
  let loaded = false;

  function clock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '';
    const rounded = Math.round(seconds);
    return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
  }

  function safeEntry(value) {
    if (!value || !Number.isInteger(value.level) || value.level < 1 || value.level > TOTAL) return null;
    // The public manifest is only allowed to reference one of our 41 packaged files.
    if (value.src !== `walkthroughs/level-${String(value.level).padStart(2, '0')}.mp4`) return null;
    const poster = `walkthroughs/level-${String(value.level).padStart(2, '0')}.jpg`;
    if (value.poster !== poster) return null;
    return {
      level: value.level,
      title: typeof value.title === 'string' ? value.title.trim().slice(0, 96) : '',
      src: value.src,
      poster,
      durationSeconds: Number(value.durationSeconds),
    };
  }

  function buildList() {
    nodes.list.replaceChildren();
    for (let level = 1; level <= TOTAL; level++) {
      const entry = entries.get(level);
      const button = document.createElement('button');
      const number = document.createElement('span');
      const dot = document.createElement('span');
      const label = document.createElement('span');
      button.type = 'button';
      button.className = `level-card${entry ? '' : ' is-pending'}`;
      button.setAttribute('aria-label', `Комната ${level}${entry?.title ? ` — ${entry.title}` : ''}${entry ? ', смотреть прохождение' : ', запись недоступна'}`);
      button.setAttribute('aria-current', String(level === selected));
      button.dataset.level = String(level);
      number.className = 'number';
      number.textContent = String(level).padStart(2, '0');
      dot.className = 'dot';
      dot.setAttribute('aria-hidden', 'true');
      label.className = 'label';
      label.textContent = entry?.title || (loaded ? 'Нет записи' : 'Загрузка…');
      button.append(number, dot, label);
      button.addEventListener('click', () => select(level, true));
      nodes.list.append(button);
    }
    nodes.count.textContent = `${entries.size} / ${TOTAL}`;
  }

  function select(level, play = false) {
    selected = level;
    const entry = entries.get(level);
    nodes.index.textContent = `КОМНАТА ${String(level).padStart(2, '0')} / ${TOTAL}`;
    nodes.title.textContent = entry?.title || `Комната ${level}`;
    nodes.duration.textContent = entry ? clock(entry.durationSeconds) : '';
    nodes.play.href = `./?edition=foundation&level=${level}`;
    nodes.next.disabled = level === TOTAL;
    nodes.video.pause();
    nodes.video.removeAttribute('src');
    nodes.video.removeAttribute('poster');
    nodes.video.load();
    if (entry) {
      nodes.empty.hidden = true;
      nodes.video.hidden = false;
      nodes.video.src = new URL(entry.src, location.href).href;
      nodes.video.poster = new URL(entry.poster, location.href).href;
      nodes.video.load();
      nodes.message.textContent = level === 41 ? 'Башня без чекпоинтов. Непрерывное прохождение через обычное управление и физику игры, в реальном темпе.' : `Прохождение комнаты ${level}. Нажми Play или выбери другую комнату.`;
      if (play) nodes.video.play().catch(() => {});
    } else {
      nodes.video.hidden = true;
      nodes.empty.hidden = false;
      nodes.emptyMessage.textContent = loaded ? 'Запись этой комнаты пока недоступна.' : 'Загружаем список записей…';
      nodes.message.textContent = loaded ? 'Можно открыть комнату в игре по кнопке ниже.' : 'Подождите, пока загрузится список.';
    }
    nodes.list.querySelectorAll('.level-card').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.level) === level)));
    const url = new URL(location.href);
    url.searchParams.set('level', String(level));
    history.replaceState(null, '', url);
  }

  nodes.next.addEventListener('click', () => { if (selected < TOTAL) select(selected + 1, true); });
  nodes.copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      nodes.message.textContent = 'Ссылка на эту комнату скопирована.';
    } catch {
      nodes.message.textContent = 'Скопируй адрес из строки браузера — он уже указывает на эту комнату.';
    }
  });
  nodes.video.addEventListener('error', () => {
    nodes.message.textContent = 'Видео не удалось загрузить. Попробуй обновить страницу.';
  });

  buildList();
  select(selected);
  fetch('./walkthroughs/manifest.json', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error('manifest unavailable'); return response.json(); })
    .then(manifest => {
      if (![1, 2].includes(manifest.version) || !Array.isArray(manifest.levels)) throw new Error('invalid manifest');
      for (const item of manifest.levels) {
        const entry = safeEntry(item);
        if (entry) entries.set(entry.level, entry);
      }
      loaded = true;
      buildList();
      select(selected);
    })
    .catch(() => {
      loaded = true;
      buildList();
      select(selected);
      nodes.message.textContent = 'Список записей пока не загрузился. Обнови страницу позже.';
    });
})();
