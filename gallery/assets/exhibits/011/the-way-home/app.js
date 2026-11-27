(() => {
  'use strict';
  const flow = window.GAME_FLOW;
  const $ = id => document.getElementById(id);
  const game = $('game'), film = $('film');
  const KEY = 'the-way-home-v1';
  let current = null, mode = 'cover', serial = 0, pendingChoice = null;
  let history = [], memory = [], saved = null, wantsPaused = false;
  let muted = false, subtitles = true;
  const icons = {
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM17 8c3 2 3 6 0 8M20 5c5 4 5 10 0 14"/></svg>',
    muted: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l6 6M23 9l-6 6"/></svg>'
  };
  function readSave() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      if (value && flow.nodes[value.current] && Array.isArray(value.history) && Array.isArray(value.memory)) saved = value;
    } catch { saved = null; }
    $('continue').hidden = !saved;
  }
  function persist() {
    if (!current || mode !== 'player') return;
    saved = { current, history: [...history], memory: [...memory] };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Private browsing can disable storage. */ }
  }
  function changeMode(nextMode) {
    mode = nextMode;
    game.className = 'game mode-' + nextMode;
    for (const name of ['cover', 'player', 'ending']) $(name).hidden = name !== nextMode;
  }
  function updateJourney(chapter) {
    $('chapter-number').textContent = String(chapter + 1).padStart(2, '0') + ' / 06';
    $('chapter-title').textContent = flow.chapters[chapter];
    $('journey').replaceChildren(...flow.chapters.map((name, i) => {
      const stop = document.createElement('div');
      stop.className = 'journey-stop' + (i === chapter ? ' current' : i < chapter ? ' passed' : '');
      if (i === chapter) stop.setAttribute('aria-current', 'step');
      const bar = document.createElement('span'); bar.className = 'bar';
      const label = document.createElement('span'); label.textContent = name;
      stop.append(bar, label); return stop;
    }));
  }
  function updatePause() {
    const paused = film.paused && !film.ended;
    $('pause').innerHTML = paused ? icons.play : icons.pause;
    $('pause').setAttribute('aria-label', paused ? '继续播放' : '暂停');
    $('play-state').textContent = film.ended ? '停留 · 等待你的选择' : paused ? '停留 · 时间暂停了' : '沿途 · 记忆正在播放';
  }
  async function playMedia(token = serial) {
    try {
      await film.play();
      if (token === serial) { $('notice').hidden = true; updatePause(); }
    } catch (error) {
      if (token !== serial || mode !== 'player' || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        $('loading').hidden = true;
        $('notice').textContent = '点击这里，继续这段回忆';
        $('notice').hidden = false;
        $('notice').setAttribute('role', 'button');
        $('notice').tabIndex = 0;
      } else showError('文件可能无法解码。请使用新版 Chrome 或 Edge 打开，或点击重试。');
    }
  }
  function showError(message) {
    if (mode !== 'player') return;
    $('loading').hidden = true; $('notice').hidden = true; $('choices').hidden = true;
    $('error-message').textContent = message;
    $('error').hidden = false;
    $('retry').focus({preventScroll:true});
  }
  function enterNode(id) {
    if (id === flow.ending) { finish(); return; }
    const node = flow.nodes[id];
    if (!node) { showError('没有找到下一段回忆。请返回封面重新开始。'); return; }
    serial++; const token = serial;
    film.pause();
    current = id; pendingChoice = null; wantsPaused = false;
    if (history[history.length - 1] !== id) history.push(id);
    changeMode('player');
    $('choices').hidden = true; $('caption').textContent = '';
    $('error').hidden = true; $('notice').hidden = true; $('loading').hidden = false;
    $('choice-buttons').replaceChildren();
    $('atmosphere').style.backgroundImage = `url("assets/${node.file}.jpg")`;
    updateJourney(node.chapter); persist();
    film.muted = muted;
    film.poster = 'assets/' + node.file + '.jpg';
    film.src = 'video/' + node.file + '.mp4';
    film.load();
    playMedia(token);
    $('pause').focus({preventScroll:true});
  }
  function showChoices() {
    const node = flow.nodes[current];
    if (!node?.choices || !$('error').hidden || mode !== 'player') return;
    const firstShow = $('choices').hidden;
    if (firstShow) {
      $('choice-prompt').textContent = node.prompt;
      $('choice-buttons').replaceChildren(...node.choices.map((choice, index) => {
        const button = document.createElement('button'); button.className = 'choice-button';
        const label = document.createElement('span'); label.className = 'choice-label'; label.textContent = choice.label;
        const detail = document.createElement('span'); detail.className = 'choice-detail'; detail.textContent = choice.detail;
        const arrow = document.createElement('span'); arrow.className = 'choice-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
        const key = document.createElement('span'); key.className = 'choice-key'; key.textContent = String(index + 1); key.setAttribute('aria-hidden', 'true');
        button.append(label, detail, arrow, key);
        button.addEventListener('click', () => selectChoice(index)); return button;
      }));
      $('choices').hidden = false; game.classList.add('choosing');
    }
    $('choice-help').textContent = pendingChoice !== null ? '记住了。片段结束后，就沿这个方向走。' : film.ended ? '时间停在这里，等你决定。也可以按数字键选择。' : '选择后会看完当前片段，再继续往前。';
    if (firstShow && film.ended) $('choice-buttons').querySelector('button')?.focus({preventScroll:true});
  }
  function selectChoice(index) {
    if (mode !== 'player' || $('choices').hidden || pendingChoice !== null) return;
    const choice = flow.nodes[current].choices?.[index];
    if (!choice) return;
    pendingChoice = index;
    [...$('choice-buttons').children].forEach((button, i) => { button.disabled = true; button.classList.toggle('selected', i === index); });
    if (film.ended) advanceChoice(); else showChoices();
  }
  function advanceChoice() {
    const choice = flow.nodes[current]?.choices?.[pendingChoice];
    if (!choice) return;
    if (choice.memory) memory.push(choice.memory);
    enterNode(choice.next);
  }
  function tick() {
    if (mode !== 'player' || !current) return;
    const node = flow.nodes[current];
    const caption = subtitles ? node.captions?.find(([from, to]) => film.currentTime >= from && film.currentTime < to) : null;
    $('caption').textContent = caption?.[2] || '';
    if (node.choices && Number.isFinite(film.duration) && film.currentTime >= film.duration - 1.5) showChoices();
  }
  film.addEventListener('timeupdate', tick);
  film.addEventListener('ended', () => {
    if (mode !== 'player') return;
    $('loading').hidden = true; $('caption').textContent = ''; updatePause();
    const node = flow.nodes[current];
    if (node.choices) {
      if (pendingChoice !== null) advanceChoice(); else showChoices();
    } else enterNode(node.next);
  });
  film.addEventListener('error', () => showError('视频文件未找到或格式不受支持。请确认 video 文件夹与网页放在一起，再点击重试。'));
  film.addEventListener('waiting', () => { if (mode === 'player' && !film.ended && !wantsPaused) $('loading').hidden = false; });
  film.addEventListener('playing', () => { $('loading').hidden = true; $('notice').hidden = true; updatePause(); });
  film.addEventListener('loadeddata', () => { $('loading').hidden = true; });
  film.addEventListener('pause', updatePause);
  film.addEventListener('play', updatePause);
  function togglePause() {
    if (mode !== 'player' || film.ended || !$('error').hidden) return;
    wantsPaused = !film.paused;
    if (wantsPaused) { film.pause(); $('loading').hidden = true; }
    else playMedia();
  }
  function goHome() {
    persist(); serial++; film.pause(); $('notice').hidden = true;
    changeMode('cover');
    $('atmosphere').style.backgroundImage = '';
    readSave(); (saved ? $('continue') : $('start')).focus({preventScroll:true});
  }
  function newGame() { history = []; memory = []; enterNode(flow.start); }
  function requestNewGame() {
    if (saved && mode === 'cover') { $('restart-dialog').showModal(); return; }
    newGame();
  }
  function finish() {
    serial++; film.pause(); current = null; saved = null;
    try { localStorage.removeItem(KEY); } catch { /* Storage is optional. */ }
    $('continue').hidden = true;
    $('end-route').textContent = memory.length ? '这一程，你' + memory.join('，') + '。' : '走过雨街，穿过黑暗，终于看见熟悉的灯。';
    changeMode('ending');
    $('restart').focus({preventScroll:true});
  }
  $('start').addEventListener('click', requestNewGame);
  $('continue').addEventListener('click', () => {
    if (!saved) return;
    history = saved.history.filter(id => flow.nodes[id]);
    memory = saved.memory.filter(value => typeof value === 'string');
    enterNode(saved.current);
  });
  $('home').addEventListener('click', goHome); $('error-home').addEventListener('click', goHome);
  $('retry').addEventListener('click', () => enterNode(current));
  $('notice').addEventListener('click', () => { wantsPaused = false; playMedia(); });
  $('notice').addEventListener('keydown', event => { if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); wantsPaused = false; playMedia(); } });
  $('pause').addEventListener('click', togglePause);
  $('mute').addEventListener('click', () => {
    muted = !muted; film.muted = muted;
    $('mute').setAttribute('aria-pressed', String(muted));
    $('mute').setAttribute('aria-label', muted ? '打开声音' : '关闭声音');
    $('mute').innerHTML = muted ? icons.muted : icons.sound;
  });
  $('captions').addEventListener('click', () => {
    subtitles = !subtitles;
    $('captions').setAttribute('aria-pressed', String(subtitles));
    $('captions').setAttribute('aria-label', subtitles ? '关闭字幕' : '打开字幕'); tick();
  });
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (game.requestFullscreen) await game.requestFullscreen();
      else { $('notice').textContent = '当前浏览器暂不支持全屏，可以横屏观看。'; $('notice').hidden = false; }
    } catch { /* Some mobile browsers don't allow full-screen elements. */ }
  });
  document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏'));
  $('restart').addEventListener('click', newGame);
  $('end-home').addEventListener('click', goHome);
  $('confirm-restart').addEventListener('click', () => { $('restart-dialog').close(); newGame(); });
  $('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
  document.addEventListener('keydown', event => {
    if (mode !== 'player' || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); selectChoice(Number(event.key) - 1); return; }
    // Let focused buttons handle Enter/Space natively.
    if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePause(); }
    if (event.key.toLowerCase() === 'm') $('mute').click();
    if (event.key.toLowerCase() === 'c') $('captions').click();
    if (event.key.toLowerCase() === 'f') $('fullscreen').click();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'player' && !film.paused) { wantsPaused = true; film.pause(); } });
  window.addEventListener('pagehide', persist);
  readSave();
})();
