import fs from 'node:fs';

// Reuse the two-sided display stand. Replace the label in both the ordinary
// and highlighted materials, preserving the common muted backdrop variant.
export function curateRacks(g, append) {
  const design = g.nodes.find(n => n.name === 'design | home');
  const operations = g.nodes.find(n => n.name === 'operations | bubbles');
  const template = g.meshes[operations.mesh];
  const variants = g.extensions.KHR_materials_variants.variants;
  const zone = team => variants.findIndex(v => v.name === 'zone-' + team);
  function printTexture(file) {
    const bytes = fs.readFileSync(new URL('./rack-prints/' + file, import.meta.url));
    const source = g.images.push({name:file, mimeType:file.endsWith('.png') ? 'image/png' : 'image/jpeg', bufferView:append(bytes)}) - 1;
    return g.textures.push({source}) - 1;
  }
  function makeStand(team, project, label, screen) {
    const mesh = structuredClone(template);
    mesh.name = team + ' | ' + project;
    for (const p of mesh.primitives) {
      const name = g.materials[p.material].name;
      const replacement = name.endsWith('label-bubbles') ? label : name.endsWith('screen-bubbles') ? screen : undefined;
      function replacePrint(index) {
        if (replacement === undefined || !g.materials[index].pbrMetallicRoughness.baseColorTexture) return index;
        const mat = structuredClone(g.materials[index]);
        mat.name = mat.name.replace('bubbles', project);
        mat.pbrMetallicRoughness.baseColorTexture.index = replacement;
        return g.materials.push(mat) - 1;
      }
      p.material = replacePrint(p.material);
      for (const mapping of p.extensions.KHR_materials_variants.mappings) {
        mapping.material = replacePrint(mapping.material);
        if (team === 'design') mapping.variants = mapping.variants.map(v =>
          v === zone('operations') ? zone('design') : v === zone('design') ? zone('operations') : v);
      }
    }
    return g.meshes.push(mesh) - 1;
  }
  const labelCenter = node => {
    const p = g.meshes[node.mesh].primitives.find(p => g.materials[p.material].name.startsWith('Exhibit print | label'));
    const b = g.accessors[p.attributes.POSITION];
    return (b.min[0] + b.max[0]) * .5 * node.scale[0] + node.translation[0];
  };
  const shift = labelCenter(design) - labelCenter(operations);
  design.scale = [...operations.scale];
  design.translation = [...operations.translation];
  design.translation[0] += shift;
  design.mesh = makeStand('design','bubbles',printTexture('bubbles-label.png'));
  design.name = 'design | bubbles';
  operations.mesh = makeStand('operations','mixue',printTexture('mixue-label.png'),printTexture('mixue-screen.jpg'));
  operations.name = 'operations | mixue';
}
