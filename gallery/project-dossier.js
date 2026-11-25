(() => {
  const archive = document.querySelector('.project-index');
  const folder = document.querySelector('.project-dossier');
  if (!archive || !folder || typeof folder.showModal !== 'function') return;

  const tab = folder.querySelector('.file-tab');
  const title = folder.querySelector('h2');
  const gallery = folder.querySelector('.file-gallery');
  const copy = folder.querySelector('.file-copy');
  const more = folder.querySelector('.file-more');
  const close = folder.querySelector('.file-close');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let opener;
  let closingTimer;
  const description = folder.querySelector('.file-description');
  const resources = document.createElement('nav');
  resources.className = 'file-actions';
  resources.setAttribute('aria-label', '项目入口');
  title.after(resources);
  more.remove();

  function showResources(content, record, link) {
    const submitted = content.querySelector('.project-resources');
    resources.replaceChildren(...(submitted ? Array.from(submitted.children) : []));
    submitted?.remove();
    more.hidden = !record.hasAttribute('data-more');
    if (more.hidden) more.removeAttribute('href');
    else {
      more.href = link.href;
      resources.append(more);
    }
    resources.hidden = resources.childElementCount === 0;
  }

  function showPlates(record, link, content) {
    gallery.classList.toggle('file-editorial', record.dataset.layout === 'editorial');
    gallery.classList.toggle('file-slides', record.dataset.layout === 'slides');
    const plates = content.querySelector('template.file-plates');
    if (plates) {
      gallery.replaceChildren(plates.content.cloneNode(true));
      gallery.classList.remove('file-object');
      plates.remove();
      return;
    }
    const data = record.dataset;
    gallery.classList.toggle('file-object', !data.plate);
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = data.plate || link.querySelector('.entry-art').src;
    image.alt = data.plateAlt || data.alt;
    const caption = document.createElement('figcaption');
    caption.textContent = data.plateCaption || data.caption;
    figure.append(image, caption);
    gallery.replaceChildren(figure);
  }

  function dismiss() {
    if (!folder.open || folder.classList.contains('closing')) return;
    folder.classList.add('closing');
    closingTimer = setTimeout(() => folder.close(), reduce.matches ? 0 : 340);
  }

  archive.addEventListener('click', event => {
    const link = event.target.closest('a.object-link');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const record = link.parentElement.querySelector('template');
    if (!record || !record.content) return;
    event.preventDefault();
    opener = link;
    const content = record.content.cloneNode(true);
    showPlates(record, link, content);
    showResources(content, record, link);
    tab.textContent = record.dataset.code;
    title.textContent = link.querySelector('.object-label').textContent;
    copy.replaceChildren(content);
    folder.classList.remove('closing');
    folder.showModal();
    const leadFilm = gallery.querySelector('video[autoplay]');
    if (leadFilm) {
      leadFilm.muted = true;
      leadFilm.play().catch(() => {});
    }
    document.documentElement.classList.add('file-is-open');
    folder.querySelector('.file-sleeve').scrollTop = 0;
    gallery.scrollTop = 0;
    description.scrollTop = 0;
    copy.scrollTop = 0;
    close.focus({preventScroll:true});
  });
  close.addEventListener('click', dismiss);
  folder.addEventListener('click', event => {
    if (event.target === folder) dismiss();
  });
  folder.addEventListener('cancel', event => {
    event.preventDefault();
    dismiss();
  });
  folder.addEventListener('close', () => {
    clearTimeout(closingTimer);
    gallery.querySelectorAll('video').forEach(film => film.pause());
    gallery.replaceChildren();
    folder.classList.remove('closing');
    document.documentElement.classList.remove('file-is-open');
    opener?.focus({preventScroll:true});
  });

  // Older dossier URLs now open the same project drawer used by the index.
  const requestedProject = new URL(location.href).searchParams.get('project');
  if (/^vx-\d{3}$/.test(requestedProject || '')) {
    archive.querySelector(`#object-${requestedProject} .object-link`)?.click();
  }
})();
