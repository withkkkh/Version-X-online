(() => {
  const archive = document.querySelector('.project-index');
  const folder = document.querySelector('.project-dossier');
  if (!archive || !folder || typeof folder.showModal !== 'function') return;

  const tab = folder.querySelector('.file-tab');
  const title = folder.querySelector('h2');
  const visual = folder.querySelector('.file-photo');
  const caption = folder.querySelector('figcaption');
  const copy = folder.querySelector('.file-copy');
  const more = folder.querySelector('.file-more');
  const close = folder.querySelector('.file-close');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let opener;
  let closingTimer;

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
    visual.src = art.currentSrc || art.src;
    visual.alt = record.dataset.alt;
    caption.textContent = record.dataset.caption;
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
