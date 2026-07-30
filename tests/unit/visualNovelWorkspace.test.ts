import { describe, expect, it } from 'vitest';
import type {
  NarrativeConversationV1,
} from '../../packages/contracts/src/index.js';
import {
  findConversationDependencies,
  getVisualNovelDirtyFiles,
  getVisualNovelWorkspaceDocuments,
  serializeNarrativeConversation,
  type VisualNovelWorkspace,
} from '../../src/domain/tools/visualNovelWorkspace.js';

const conversation: NarrativeConversationV1 = {
  schemaVersion: 1,
  conversationId: 'conversation:prologue:start',
  title: 'Inicio del prólogo',
  tags: ['prólogo'],
  initialCueId: 'cue:start',
  once: false,
  cues: [{
    cueId: 'cue:start',
    kind: 'narration',
    text: 'Comienza.',
    actions: [],
    outcomeId: 'completed',
  }],
};

function workspace(): VisualNovelWorkspace {
  return {
    root: { kind: 'directory', name: 'pokemon voice' } as VisualNovelWorkspace['root'],
    conversations: [conversation],
    fileNameByConversationId: {},
    mediaManifest: { schemaVersion: 1, assets: [] },
    pmdManifest: { schemaVersion: 1, tickRate: 60, assets: [] },
    missionDocuments: [{
      schemaVersion: 1,
      mapId: 'map:tegueste',
      narrativeSequences: [],
      missions: [{
        schemaVersion: 1,
        missionId: 'mission:prologue',
        mapId: 'map:tegueste',
        title: 'Prólogo',
        loadingText: 'Cargando',
        briefing: 'Empieza.',
        objectives: [],
        mapVariantIds: [],
        rewards: [],
        unlocksFreeExpedition: false,
        flow: {
          schemaVersion: 1,
          initialNodeId: 'node:start',
          nodes: [{
            kind: 'conversation',
            nodeId: 'node:start',
            conversationId: conversation.conversationId,
            outcomes: {},
          }],
        },
      }],
    }],
    baselineByFileName: {},
    handlesByFileName: {},
  };
}

describe('espacio de trabajo de novela visual', () => {
  it('serializa un archivo por conversación y un manifiesto global', () => {
    const documents = getVisualNovelWorkspaceDocuments(workspace(), [conversation]);
    expect(Object.keys(documents.documents).sort()).toEqual([
      'manifest.v1.json',
      'start.conversation.json',
    ]);
    expect(JSON.parse(documents.documents['manifest.v1.json']).conversations[0])
      .toMatchObject({
        conversationId: conversation.conversationId,
        documentPath: 'assets/adventure/narratives/start.conversation.json',
      });
    expect(serializeNarrativeConversation(conversation)).toMatch(/\n$/u);
  });

  it('detecta documentos pendientes y dependencias que bloquean el borrado', () => {
    const current = workspace();
    expect(getVisualNovelDirtyFiles(current, [conversation]).sort()).toEqual([
      'manifest.v1.json',
      'start.conversation.json',
    ]);
    expect(findConversationDependencies(current, conversation.conversationId))
      .toEqual([{ missionId: 'mission:prologue', title: 'Prólogo' }]);
  });
});
