const fs = require('node:fs/promises');
const path = require('node:path');
const { file } = require('../../src/features/outside/npc-placement.js');

// Editor revisions cover both dialogue and independently saved scene placements.
// A disposable editor must start with the same sources as the real editor.
module.exports = async function copyEditorSource(base) {
  const data = path.resolve(__dirname, '../../data');
  const placementDir = path.resolve(base, '../presentation');
  await fs.cp(path.join(data, 'shared-csv'), base, {recursive: true});
  await fs.mkdir(placementDir, {recursive: true});
  await fs.copyFile(path.join(data, 'presentation', file), path.join(placementDir, file));
};
