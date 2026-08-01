import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mapsRoot = path.join(root, 'public', 'assets', 'adventure', 'maps');
const outlinePath = path.join(root, 'public', 'assets', 'adventure', 'story', 'outline.v1.json');

const findMissionFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? findMissionFiles(target) : entry.name.endsWith('.missions.json') ? [target] : [];
});

const documents = findMissionFiles(mapsRoot).map(file => ({ file, value: JSON.parse(fs.readFileSync(file, 'utf8')) }));
const missions = documents.flatMap(({ value }) => value.missions.map(mission => ({
  ...mission,
  publicationStatus: mission.schemaVersion === 2 ? mission.publicationStatus : 'published',
})));
const ids = new Set();
for (const mission of missions) {
  if (!mission.missionId || ids.has(mission.missionId)) throw new Error(`Misión duplicada o vacía: ${mission.missionId}.`);
  ids.add(mission.missionId);
}
if (!fs.existsSync(outlinePath)) throw new Error('Falta public/assets/adventure/story/outline.v1.json.');
const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf8'));
if (outline.schemaVersion !== 1 || !Array.isArray(outline.acts)) throw new Error('El outline global no es válido.');
const assignments = new Map();
for (const act of outline.acts) {
  if (!act.actId || !Array.isArray(act.chapters)) throw new Error('El outline contiene un acto inválido.');
  for (const chapter of act.chapters) {
    if (!chapter.chapterId || !Array.isArray(chapter.missionIds)) throw new Error(`${act.actId}: capítulo inválido.`);
    for (const missionId of chapter.missionIds) {
      if (!ids.has(missionId)) throw new Error(`${chapter.chapterId}: misión inexistente ${missionId}.`);
      assignments.set(missionId, (assignments.get(missionId) ?? 0) + 1);
    }
  }
}
for (const mission of missions.filter(item => item.publicationStatus === 'published')) {
  if (assignments.get(mission.missionId) !== 1) throw new Error(`${mission.missionId}: debe aparecer exactamente en un capítulo.`);
}

const dependencies = new Map(missions.map(mission => [mission.missionId, new Set()]));
const collect = (expression, target) => {
  if (!expression) return;
  if (Array.isArray(expression.all)) return expression.all.forEach(child => collect(child, target));
  if (Array.isArray(expression.any)) return expression.any.forEach(child => collect(child, target));
  if (expression.kind === 'completedMission') {
    if (!ids.has(expression.missionId)) throw new Error(`${target}: dependencia inexistente ${expression.missionId}.`);
    dependencies.get(target).add(expression.missionId);
  }
};
for (const mission of missions) collect(mission.availability, mission.missionId);
const visiting = new Set();
const visited = new Set();
const visit = id => {
  if (visiting.has(id)) throw new Error(`Dependencia circular de misión en ${id}.`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of dependencies.get(id) ?? []) visit(dependency);
  visiting.delete(id);
  visited.add(id);
};
for (const id of ids) visit(id);

console.log(`Historia válida: ${missions.length} misiones, ${outline.acts.length} actos.`);
