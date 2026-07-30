import { describe, expect, it } from 'vitest';
import type {
  NarrativeConversationV1,
  NarrativeSequenceV1,
} from '../../packages/contracts/src/index.js';
import {
  applyNarrativeStageAction,
  buildNarrativeManifest,
  buildNarrativeTokenValues,
  findNarrativeCuePath,
  migrateNarrativeSequence,
  reconstructNarrativeStage,
  resolveNarrativeText,
  validateNarrativeConversation,
} from '../../src/domain/narrative/visualNovel.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';

function conversation(): NarrativeConversationV1 {
  return {
    schemaVersion: 1,
    conversationId: 'conversation:test',
    title: 'Prueba',
    tags: ['test'],
    initialCueId: 'cue:start',
    once: false,
    cues: [
      {
        cueId: 'cue:start',
        kind: 'dialogue',
        speakerName: 'Alcanfor',
        text: 'Elige.',
        actions: [
          {
            kind: 'setBackground',
            backgroundAssetId: 'background:forest',
            phase: 'beforeText',
          },
          {
            kind: 'enterActor',
            actorId: 'actor:alcanfor',
            source: { kind: 'illustration', assetId: 'pose:alcanfor:neutral' },
            poseAssetId: 'pose:alcanfor:neutral',
            transform: { slot: 'right' },
            phase: 'beforeText',
          },
        ],
        choices: [
          { choiceId: 'choice:left', label: 'Izquierda', nextCueId: 'cue:left' },
          { choiceId: 'choice:right', label: 'Derecha', nextCueId: 'cue:right' },
        ],
      },
      {
        cueId: 'cue:left',
        kind: 'dialogue',
        speakerName: 'Alcanfor',
        text: 'Por aquí.',
        actions: [{
          kind: 'moveActor',
          actorId: 'actor:alcanfor',
          transform: { slot: 'left', scale: 1.2 },
          motion: 'slide',
          phase: 'withText',
        }],
        nextCueId: 'cue:end',
      },
      {
        cueId: 'cue:right',
        kind: 'dialogue',
        speakerName: 'Alcanfor',
        text: 'Por allá.',
        actions: [],
        nextCueId: 'cue:end',
      },
      {
        cueId: 'cue:end',
        kind: 'narration',
        text: 'Fin.',
        actions: [],
        outcomeId: 'completed',
      },
    ],
  };
}

describe('conversaciones de novela visual', () => {
  it('reconstruye fondo, presencia y posición al previsualizar una rama', () => {
    const document = conversation();
    expect(findNarrativeCuePath(document, 'cue:end', {
      'cue:start': 'choice:left',
    })).toEqual(['cue:start', 'cue:left', 'cue:end']);
    const stage = reconstructNarrativeStage(document, 'cue:end', {
      'cue:start': 'choice:left',
    });
    expect(stage.backgroundAssetId).toBe('background:forest');
    expect(stage.actors['actor:alcanfor']).toMatchObject({
      poseAssetId: 'pose:alcanfor:neutral',
      transform: { slot: 'left', scale: 1.2 },
    });
  });

  it('encuentra un camino editorial a cualquier diálogo sin exigir elecciones previas', () => {
    expect(findNarrativeCuePath(conversation(), 'cue:right'))
      .toEqual(['cue:start', 'cue:right']);
  });

  it('cambia la animación de un actor PMD sin perder su posición', () => {
    const entered = applyNarrativeStageAction({ actors: {}, playingAudio: {} }, {
      kind: 'enterActor',
      actorId: 'actor:lapras',
      source: { kind: 'pmd', assetId: 'pmd:0131-lapras:default', animationName: 'Idle' },
      transform: { slot: 'left', scale: 1.4 },
      phase: 'beforeText',
    });
    const animated = applyNarrativeStageAction(entered, {
      kind: 'setActorAnimation',
      actorId: 'actor:lapras',
      animationName: 'Attack',
      phase: 'withText',
    });
    expect(animated.actors['actor:lapras']).toMatchObject({
      source: { animationName: 'Attack' },
      transform: { slot: 'left', scale: 1.4 },
    });
  });

  it('solo permite ciclos causados por elecciones explícitas', () => {
    const choiceLoop = conversation();
    choiceLoop.cues[3] = {
      ...choiceLoop.cues[3],
      outcomeId: undefined,
      choices: [{
        choiceId: 'choice:repeat',
        label: 'Volver',
        nextCueId: 'cue:start',
      }],
    };
    expect(validateNarrativeConversation(choiceLoop)).not.toContain(
      expect.stringContaining('ciclo automático'),
    );

    const directLoop = conversation();
    directLoop.cues[3] = {
      ...directLoop.cues[3],
      outcomeId: undefined,
      nextCueId: 'cue:left',
    };
    expect(validateNarrativeConversation(directLoop).some(error => (
      error.includes('ciclo automático')
    ))).toBe(true);

    const inputLoop = conversation();
    inputLoop.cues[3] = {
      ...inputLoop.cues[3],
      outcomeId: undefined,
      textInput: {
        inputId: 'input:loop',
        label: 'Nombre',
        variableId: 'player.alias',
        maxLength: 20,
        submitLabel: 'Volver',
        nextCueId: 'cue:left',
      },
    };
    expect(validateNarrativeConversation(inputLoop).some(error => (
      error.includes('ciclo automático')
    ))).toBe(true);
  });

  it('exige IDs únicos a las acciones persistentes', () => {
    const document = conversation();
    document.cues[0].actions[0] = {
      ...document.cues[0].actions[0],
      persistent: true,
    };
    expect(validateNarrativeConversation(document).some(error => (
      error.includes('persistente necesita ID')
    ))).toBe(true);
    document.cues[0].actions[0].actionId = 'action:persistent';
    document.cues[0].actions[1].actionId = 'action:persistent';
    expect(validateNarrativeConversation(document).some(error => (
      error.includes('ID de acción duplicado')
    ))).toBe(true);
  });

  it('resuelve fichas tipadas y conserva IDs al migrar contenido antiguo', () => {
    expect(resolveNarrativeText('Hola {{player.name}} y {{flag:unknown}}.', {
      'player.name': 'Guayota',
    })).toBe('Hola Guayota y {{flag:unknown}}.');
    const sequence: NarrativeSequenceV1 = {
      schemaVersion: 1,
      sequenceId: 'sequence:legacy',
      initialPageId: 'page:legacy:1',
      once: true,
      pages: [{
        pageId: 'page:legacy:1',
        speakerId: 'npc:camphor',
        speakerName: 'Alcanfor',
        text: 'Hola.',
        portraitState: 'neutral',
        action: { kind: 'completeSequence' },
      }],
    };
    const migrated = migrateNarrativeSequence(sequence, 'Legado');
    expect(migrated.conversationId).toBe(sequence.sequenceId);
    expect(migrated.initialCueId).toBe(sequence.initialPageId);
    expect(migrated.cues[0].cueId).toBe(sequence.pages[0].pageId);
  });

  it('expone perfil, objetos, contadores y flags públicos como fichas', () => {
    const save = createPokeVoiceSaveV1({ runId: 'run:narrative-tokens', now: 1 });
    save.pokeDiscover.trainerProfile = {
      schemaVersion: 1,
      avatarId: 'guayota',
      displayName: 'Guayota',
    };
    save.pokeDiscover.inventory.keyItemIds.push('item:poke-flute');
    save.pokeDiscover.globalCounters['rescues'] = 2;
    save.pokeDiscover.worldFlags['snorlax-awake'] = true;
    expect(buildNarrativeTokenValues(save)).toMatchObject({
      'player.name': 'Guayota',
      'player.avatar': 'guayota',
      'item:item:poke-flute': true,
      'counter:rescues': 2,
      'flag:snorlax-awake': true,
    });
  });

  it('genera un manifiesto determinista y rechaza IDs repetidos', () => {
    const first = conversation();
    const second = { ...conversation(), conversationId: 'conversation:alpha', title: 'Alpha' };
    expect(buildNarrativeManifest([
      { document: first, documentPath: 'z.conversation.json' },
      { document: second, documentPath: 'a.conversation.json' },
    ]).conversations.map(item => item.conversationId))
      .toEqual(['conversation:alpha', 'conversation:test']);
    expect(() => buildNarrativeManifest([
      { document: first, documentPath: 'one.json' },
      { document: first, documentPath: 'two.json' },
    ])).toThrow('duplicada');
  });
});
