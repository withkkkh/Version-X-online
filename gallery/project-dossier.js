(() => {
  const index = document.querySelector('.project-index');
  const dialog = document.querySelector('.project-dossier');
  if (!index || !dialog || typeof dialog.showModal !== 'function') return;
  const sleeve = dialog.querySelector('.file-sleeve');
  const gallery = dialog.querySelector('.file-gallery');
  const description = dialog.querySelector('.file-description');
  const contents = description.querySelector('.file-contents');
  const close = dialog.querySelector('.file-close');
  const mobile = matchMedia('(max-width:760px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)');
  let opener, sections = [], buttons = [], frame, closing;

  let videoObserver;
  let activeVideo;
  const finished = new WeakSet();

  function setLoop(event) {
    const video = event.target;
    if (video instanceof HTMLVideoElement) {
      video.loop = video.duration > 0 && video.duration < 10;
    }
  }
  gallery.addEventListener('loadedmetadata', setLoop, true);
  gallery.addEventListener('durationchange', setLoop, true);
  gallery.addEventListener('ended', event => finished.add(event.target), true);

  function stopVideos() {
    videoObserver?.disconnect();
    videoObserver = undefined;
    activeVideo = undefined;
    gallery.querySelectorAll('video').forEach(video => video.pause());
  }
  function observeVideos() {
    stopVideos();
    if (reduceMotion.matches || !dialog.open || !('IntersectionObserver' in window)) return;
    const visibility = new Map();
    const observer = new IntersectionObserver(entries => {
      if (observer !== videoObserver || !dialog.open) return;
      for (const entry of entries) visibility.set(entry.target, entry.intersectionRatio);
      let candidate;
      let largest = 0.24;
      for (const [video, ratio] of visibility) {
        if (ratio > largest) {
          candidate = video;
          largest = ratio;
        }
      }
      if (candidate === activeVideo) return;
      activeVideo?.pause();
      activeVideo = candidate;
      if (candidate && !finished.has(candidate)) candidate.play().catch(() => {});
    }, {threshold:[0, .25, .4, .55, .7, .85, 1]});
    videoObserver = observer;
    gallery.querySelectorAll('video').forEach(video => observer.observe(video));
  }
  reduceMotion.addEventListener('change', observeVideos);

  function scrollArea() { return mobile.matches ? sleeve : gallery; }
  function highlight() {
    frame = 0;
    const area = scrollArea();
    const threshold = area.getBoundingClientRect().top + Math.min(150,area.clientHeight / 4);
    const atEnd = area.scrollHeight > area.clientHeight && area.scrollTop + area.clientHeight >= area.scrollHeight - 2;
    let current = 0;
    sections.forEach((section,i) => {
      if (atEnd || section.getBoundingClientRect().top <= threshold) current = i;
    });
    buttons.forEach((button,i) => {
      if (i === current) button.setAttribute('aria-current','location');
      else button.removeAttribute('aria-current');
    });
  }
  function scheduleHighlight() {
    if (dialog.open && !frame) frame = requestAnimationFrame(highlight);
  }
  for (const area of [sleeve,gallery]) area.addEventListener('scroll',scheduleHighlight,{passive:true});
  window.addEventListener('resize', scheduleHighlight);
  gallery.addEventListener('load',scheduleHighlight,true);
  gallery.addEventListener('play',event => {
    if (event.target.tagName === 'VIDEO') gallery.querySelectorAll('video').forEach(other => {
      if (other !== event.target) other.pause();
    });
  },true);
  contents.addEventListener('click',event => {
    const button = event.target.closest('button');
    const section = sections[buttons.indexOf(button)];
    if (!section) return;
    const area = scrollArea();
    const top = area.scrollTop + section.getBoundingClientRect().top - area.getBoundingClientRect().top;
    area.scrollTo({top,behavior:reduceMotion.matches ? 'instant' : 'smooth'});
    section.focus({preventScroll:true});
  });

  function openProject(link) {
    const record = link.parentElement.querySelector('template');
    if (!record) return;
    clearTimeout(closing);
    stopVideos();
    dialog.classList.remove('closing');
    opener = link;
    const content = document.importNode(record.content,true);
    const media = content.querySelector('template.file-plates');
    gallery.replaceChildren(document.importNode(media.content,true));
    media.remove();
    dialog.dataset.edition = record.dataset.edition || "";
    dialog.style.setProperty('--file-accent',record.dataset.accent);
    dialog.querySelector('.file-tab').textContent = record.dataset.code.split(' / ')[0] + '.';
    description.querySelector('h2').textContent = link.querySelector('.object-label').textContent;
    description.querySelector('.file-copy').replaceChildren(content);
    sections = Array.from(gallery.querySelectorAll(':scope > section'));
    buttons = sections.map((section,i) => {
      const button = document.createElement('button');
      button.type = 'button';
      section.id = 'archive-section-' + i;
      section.tabIndex = -1;
      button.setAttribute('aria-controls',section.id);
      const number = document.createElement('span');
      number.textContent = String(i+1).padStart(2,'0');
      button.append(section.dataset.label,number);
      return button;
    });
    contents.replaceChildren(...buttons);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('file-is-open');
    sleeve.scrollTop = gallery.scrollTop = description.scrollTop = 0;
    close.focus({preventScroll:true});
    highlight();
    observeVideos();
  }
  function dismiss() {
    if (!dialog.open || dialog.classList.contains('closing')) return;
    dialog.classList.add('closing');
    stopVideos();
    closing = setTimeout(() => dialog.close(),reduceMotion.matches ? 0 : 280);
  }
  function syncLocation() {
    const id = new URL(location.href).searchParams.get('project') || history.state?.fileProject;
    const link = /^vx-\d{3}$/.test(id || '') && index.querySelector('#object-' + id + ' .object-link');
    if (link) openProject(link); else dismiss();
  }
  function leave() {
    if (history.state?.archiveEntry) history.back();
    else {
      const url = new URL(location.href);
      url.searchParams.delete('project');
      if (opener) url.hash = opener.parentElement.id;
      history.replaceState(history.state,'',url);
      dismiss();
    }
  }
  index.addEventListener('click',event => {
    const link = event.target.closest('a.object-link');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const id = link.parentElement.id;
    if (location.protocol === 'file:') {
      history.pushState({archiveEntry:true,fileProject:id.slice(7)},'','#' + id);
    } else {
      history.pushState({archiveEntry:true},'',link.href);
    }
    openProject(link);
  });
  close.addEventListener('click',leave);
  dialog.addEventListener('click',event => { if (event.target === dialog) leave(); });
  dialog.addEventListener('cancel',event => { event.preventDefault(); leave(); });
  dialog.addEventListener('close',() => {
    if (dialog.open) return;
    clearTimeout(closing);
    stopVideos();
    gallery.replaceChildren();
    dialog.classList.remove('closing');
    document.documentElement.classList.remove('file-is-open');
    opener?.focus({preventScroll:true});
  });
  window.addEventListener('popstate',syncLocation);
  syncLocation();
})();
