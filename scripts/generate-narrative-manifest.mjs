import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const narrativesRoot = path.join(publicRoot, 'assets', 'adventure', 'narratives');
const outputPath = path.join(narrativesRoot, 'manifest.v1.json');

const conversationFiles = fs.existsSync(narrativesRoot)
  ? fs.readdirSync(narrativesRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.conversation.json'))
    .map(entry => path.join(narrativesRoot, entry.name))
  : [];
const used = new Set();
const conversations = [];

for (const filePath of conversationFiles) {
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (document.schemaVersion !== 1 || typeof document.conversationId !== 'string'
    || typeof document.title !== 'string' || !Array.isArray(document.tags)
    || !Array.isArray(document.cues)) {
    throw new Error(`${path.relative(root, filePath)} no cumple NarrativeConversationV1.`);
  }
  if (used.has(document.conversationId)) {
    throw new Error(`Conversación duplicada: ${document.conversationId}.`);
  }
  used.add(document.conversationId);
  const cueIds = new Set(document.cues.map(cue => cue.cueId));
  if (!cueIds.has(document.initialCueId)) {
    throw new Error(`${document.conversationId}: el cue inicial no existe.`);
  }
  const directNext = new Map();
  for (const cue of document.cues) {
    if (!cue.cueId || !Array.isArray(cue.actions)) {
      throw new Error(`${document.conversationId}: cue inválido.`);
    }
    if (cue.nextCueId) {
      if (!cueIds.has(cue.nextCueId)) throw new Error(`${cue.cueId}: destino inexistente.`);
      directNext.set(cue.cueId, cue.nextCueId);
    }
    for (const choice of cue.choices ?? []) {
      if (Boolean(choice.nextCueId) === Boolean(choice.outcomeId)) {
        throw new Error(`${choice.choiceId}: debe enlazar cue o resultado.`);
      }
      if (choice.nextCueId && !cueIds.has(choice.nextCueId)) {
        throw new Error(`${choice.choiceId}: destino inexistente.`);
      }
    }
  }
  for (const cueId of cueIds) {
    const visited = new Set();
    let cursor = cueId;
    while (cursor) {
      if (visited.has(cursor)) throw new Error(`${cueId}: ciclo automático.`);
      visited.add(cursor);
      cursor = directNext.get(cursor);
    }
  }
  conversations.push({
    schemaVersion: 1,
    conversationId: document.conversationId,
    title: document.title,
    tags: [...document.tags].sort(),
    documentPath: path.relative(publicRoot, filePath).replaceAll(path.sep, '/'),
  });
}

conversations.sort((left, right) => left.conversationId.localeCompare(right.conversationId));
fs.mkdirSync(narrativesRoot, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: 1, conversations }, null, 2)}\n`);
console.log(`Manifiesto narrativo: ${conversations.length} conversaciones.`);
