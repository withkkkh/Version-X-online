const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;

async function getModelSource(fullSource) {
  if (!mobile || typeof DecompressionStream !== 'function') return fullSource;
  try {
    const response = await fetch(new URL('./assets/gallery-mobile-v31.bin', import.meta.url));
    if (!response.ok) return fullSource;
    const file = await response.blob();
    const prefix = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    let modelFile;
    if (prefix[0] === 31 && prefix[1] === 139) {
      const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
      modelFile = await new Response(stream).blob();
    } else if (String.fromCharCode(...prefix) === 'glTF') {
      modelFile = file;
    } else return fullSource;
    return URL.createObjectURL(modelFile);
  } catch {
    return fullSource;
  }
}

export async function startModel(model) {
  const fullSource = model.dataset.src;
  const [source] = await Promise.all([
    getModelSource(fullSource),
    import('./assets/model-viewer-4.4.0.min.js')
  ]);
  if (mobile) model.setAttribute('shadow-intensity', '0');
  if (source.startsWith('blob:')) {
    const release = () => URL.revokeObjectURL(source);
    model.addEventListener('load', release, { once:true });
    model.addEventListener('error', () => {
      release();
      model.src = fullSource;
    }, { once:true });
  }
  model.src = source;
}

const storyModel = document.querySelector('model-viewer[data-story]');
if (storyModel) startModel(storyModel).catch(() => {
  storyModel.hidden = true;
});
