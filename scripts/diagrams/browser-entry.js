// Bundled by render.mjs and loaded into headless Chromium. Never talks to the network.
import { exportToSvg, restore } from '@excalidraw/excalidraw';

async function loadFonts() {
  const base = window.EXCALIDRAW_ASSET_PATH + 'fonts/';
  const faces = [['Virgil', 'Virgil/Virgil-Regular.woff2']];
  for (const [family, file] of faces) {
    const face = new FontFace(family, `url(${base}${file})`);
    document.fonts.add(await face.load());
  }
}

// Finds bound labels that no longer fit their shape after real font measurement.
function checkLabels(elements) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const problems = [];
  const sizes = new Set();
  for (const el of elements) {
    if (el.type !== 'text' || el.isDeleted) continue;
    sizes.add(el.fontSize);
    const box = el.containerId && byId.get(el.containerId);
    if (!box) {
      // A free label grouped with a shape (icon nodes) must stay inside that shape.
      const shape = elements.find(
        (s) =>
          ['rectangle', 'ellipse', 'diamond'].includes(s.type) &&
          s.groupIds.length &&
          s.groupIds.some((g) => el.groupIds.includes(g)),
      );
      if (
        shape &&
        (el.x + el.width > shape.x + shape.width - 4 ||
          el.y + el.height > shape.y + shape.height - 2)
      )
        problems.push(
          `"${el.text}" spills out of ${shape.id} by ${(el.x + el.width - (shape.x + shape.width - 4)).toFixed(1)}px`,
        );
      continue;
    }
    const wrapped = el.text.split('\n').length !== el.originalText.split('\n').length;
    const tooTall = el.height > box.height - 4;
    if (wrapped || (tooTall && box.type !== 'arrow'))
      problems.push(`"${el.originalText}" does not fit in ${box.id}`);
  }
  return { problems, sizes: [...sizes].sort((a, b) => a - b) };
}

window.render = async (data) => {
  await loadFonts();
  const restored = restore(data, null, null, { refreshDimensions: true, repairBindings: true });
  const elements = restored.elements.filter((e) => !e.isDeleted);
  const svg = await exportToSvg({
    elements,
    appState: {
      ...restored.appState,
      exportBackground: false,
      exportWithDarkMode: false,
      exportEmbedScene: false,
    },
    files: restored.files || {},
    exportPadding: 12,
  });
  return { svg: svg.outerHTML, ...checkLabels(elements) };
};
window.ready = true;
