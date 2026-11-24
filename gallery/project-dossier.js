(() => {
  const archive = document.querySelector('.project-index');
  const folder = document.querySelector('.project-dossier');
  if (!archive || !folder || typeof folder.showModal !== 'function') return;

  const tab = folder.querySelector('.file-tab');
  const title = folder.querySelector('h2');
  const visual = folder.querySelector('.file-photo');
  const plate = folder.querySelector('picture source');
  const desktop = matchMedia(plate.media);
  const caption = folder.querySelector('figcaption');
  const copy = folder.querySelector('.file-copy');
  const more = folder.querySelector('.file-more');
  const close = folder.querySelector('.file-close');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let opener;
  let closingTimer;
  let currentRecord;

  function describeImage() {
    if (!currentRecord) return;
    const data = currentRecord.dataset;
    const showPlate = desktop.matches && data.plate;
    visual.alt = showPlate ? data.plateAlt : data.alt;
    caption.textContent = showPlate ? data.plateCaption : data.caption;
  }
  desktop.addEventListener('change', describeImage);

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
    const art = link.querySelector('.object-picture img');
    currentRecord = record;
    if (record.dataset.plate) plate.srcset = record.dataset.plate;
    else plate.removeAttribute('srcset');
    visual.src = art.currentSrc || art.src;
    describeImage();
    tab.textContent = record.dataset.code;
    title.textContent = link.querySelector('.object-label').textContent;
    copy.replaceChildren(record.content.cloneNode(true));
    more.hidden = !record.hasAttribute('data-more');
    if (more.hidden) more.removeAttribute('href');
    else more.href = link.href;
    folder.classList.remove('closing');
    folder.showModal();
    document.documentElement.classList.add('file-is-open');
    folder.querySelector('.file-scroll').scrollTop = 0;
    folder.querySelector('.file-description').scrollTop = 0;
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
    folder.classList.remove('closing');
    document.documentElement.classList.remove('file-is-open');
    opener?.focus({preventScroll:true});
  });
})();
