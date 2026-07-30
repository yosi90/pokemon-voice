import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public', 'assets', 'adventure', 'narratives');
const professor = 'professor-camphor';
const pose = state => `narrative:character:${professor}:${state}`;
const background = 'narrative:background:laboratorio-de-alcanfor';
const action = (kind, extra = {}) => ({ kind, ...extra });
const choice = (choiceId, label, nextCueId, legacyAction) => ({
  choiceId,
  label,
  nextCueId,
  ...(legacyAction ? { legacyAction } : {}),
});
const cue = (cueId, state, text, extra = {}) => ({
  cueId,
  kind: 'dialogue',
  speakerActorId: professor,
  speakerName: 'Profesor Alcanfor',
  text,
  actions: [{
    actionId: `${cueId}:action:pose:${professor}`,
    kind: 'setActorPose',
    actorId: professor,
    poseAssetId: pose(state),
    phase: 'withText',
    durationMs: 160,
  }],
  ...extra,
});
function document(conversationId, title, once, cues) {
  cues[0].actions.unshift(
    {
      actionId: `${cues[0].cueId}:action:background`,
      kind: 'setBackground',
      backgroundAssetId: background,
      transition: 'fade',
      phase: 'beforeText',
      durationMs: 250,
      blocking: true,
    },
    {
      actionId: `${cues[0].cueId}:action:enter:${professor}`,
      kind: 'enterActor',
      actorId: professor,
      source: { kind: 'illustration', assetId: pose('alegre') },
      poseAssetId: pose('alegre'),
      transform: { slot: 'right' },
      motion: 'fade',
      phase: 'beforeText',
      durationMs: 200,
    },
  );
  return {
    schemaVersion: 1,
    conversationId,
    title,
    tags: ['alcanfor', 'migrated'],
    initialCueId: cues[0].cueId,
    once,
    cues,
  };
}

const documents = [
  document('narrative:professor-camphor:introduction', 'Presentación de PokeDiscover', false, [
    cue('arrival', 'alegre', '¡Un momento! Esa Pokédex que llevas no parece estar nada mal para alguien que acaba de empezar.', { nextCueId: 'presentation' }),
    cue('presentation', 'parlanchin', 'Soy el profesor Alcanfor. Investigo cómo viven los Pokémon cuando nadie intenta encerrarlos en una tabla de datos.', { nextCueId: 'proposal' }),
    cue('proposal', 'explicando', 'Pareces un entrenador novato, pero tienes buen oído. Podría financiar tus viajes si completas algunos encargos de investigación para mí.', { nextCueId: 'offer-one' }),
    cue('offer-one', 'alegre', '¿Quieres recorrer el mundo Pokémon como parte de PokeDiscover?', { choices: [
      choice('accept-one', '¡Sí, acepto!', 'trainer-choice'),
      choice('decline-one', 'No, gracias', 'persuasion-one', action('declinePokeDiscover')),
    ] }),
    cue('persuasion-one', 'explicando', '¿He mencionado que yo pagaría los desplazamientos y el material? Las palas de calidad no crecen en los árboles.', { nextCueId: 'offer-two' }),
    cue('offer-two', 'alegre', 'Piénsalo bien. ¿Te unes a PokeDiscover?', { choices: [
      choice('accept-two', 'Está bien, acepto', 'trainer-choice'),
      choice('decline-two', 'Sigo diciendo que no', 'persuasion-two', action('declinePokeDiscover')),
    ] }),
    cue('persuasion-two', 'parlanchin', 'Conocerías jardines imposibles, volcanes, ruinas y Pokémon que casi nadie ha visto. Sería una pena dejar todo eso sin investigar.', { nextCueId: 'offer-three' }),
    cue('offer-three', 'alegre', 'Último intento: ¿empezamos este viaje juntos?', { choices: [
      choice('accept-three', 'Empecemos', 'trainer-choice'),
      choice('decline-three', 'Ahora no', 'postponed', action('declinePokeDiscover')),
    ] }),
    cue('trainer-choice', 'alegre', 'Antes de inscribirte, necesito saber quién eres. ¿Eres un chico o una chica?', { choices: [
      choice('choose-achaman', 'Soy un chico', 'trainer-name', action('selectTrainerAvatar', { avatarId: 'achaman' })),
      choice('choose-guayota', 'Soy una chica', 'trainer-name', action('selectTrainerAvatar', { avatarId: 'guayota' })),
    ] }),
    cue('trainer-name', 'parlanchin', 'Perfecto. Este es el nombre que pondré en tu ficha. Puedes cambiarlo ahora si quieres.', { textInput: {
      inputId: 'trainer-display-name',
      label: 'Nombre del entrenador',
      variableId: 'player.name',
      maxLength: 18,
      submitLabel: 'Confirmar nombre',
      nextCueId: 'accepted',
      legacyAction: 'saveTrainerNameAndAccept',
    } }),
    cue('postponed', 'alegre', 'Vaya, tienes una voluntad envidiable. No insistiré más... por hoy.', { legacyAction: action('postponePokeDiscover'), outcomeId: 'postponed' }),
    cue('accepted', 'explicando', '¡Excelente! Ya está todo listo. Desde ahora formas parte de PokeDiscover. Busca mi hoja de alcanfor cuando quieras consultar tus encargos.', { legacyAction: action('completeSequence'), outcomeId: 'accepted' }),
  ]),
  document('narrative:professor-camphor:return', 'Regreso de Alcanfor', false, [
    cue('return', 'parlanchin', '¡Otra captura para esa Pokédex! Sabía que volveríamos a encontrarnos. ¿Te unes ahora a PokeDiscover?', { choices: [
      choice('accept-return', 'Sí, acepto', 'trainer-choice'),
      choice('decline-return', 'Todavía no', 'postponed', action('declinePokeDiscover')),
    ] }),
    cue('trainer-choice', 'alegre', 'Entonces terminemos tu inscripción. ¿Eres un chico o una chica?', { choices: [
      choice('choose-achaman-return', 'Soy un chico', 'trainer-name', action('selectTrainerAvatar', { avatarId: 'achaman' })),
      choice('choose-guayota-return', 'Soy una chica', 'trainer-name', action('selectTrainerAvatar', { avatarId: 'guayota' })),
    ] }),
    cue('trainer-name', 'parlanchin', 'Este es el nombre que pondré en tu ficha. Puedes cambiarlo ahora si quieres.', { textInput: {
      inputId: 'trainer-display-name-return',
      label: 'Nombre del entrenador',
      variableId: 'player.name',
      maxLength: 18,
      submitLabel: 'Confirmar nombre',
      nextCueId: 'accepted',
      legacyAction: 'saveTrainerNameAndAccept',
    } }),
    cue('postponed', 'alegre', 'De acuerdo. Seguiré atento a tus descubrimientos.', { legacyAction: action('postponePokeDiscover'), outcomeId: 'postponed' }),
    cue('accepted', 'explicando', '¡Sabía que acabarías aceptando! Busca mi hoja de alcanfor cuando quieras consultar tus encargos.', { legacyAction: action('completeSequence'), outcomeId: 'accepted' }),
  ]),
  document('narrative:professor-camphor:trainer-profile', 'Ficha de entrenador', true, [
    cue('trainer-choice', 'alegre', 'Antes de enseñarte los encargos, terminemos tu ficha. ¿Eres un chico o una chica?', { choices: [
      choice('choose-achaman-profile', 'Soy un chico', 'trainer-name', action('selectTrainerAvatar', { avatarId: 'achaman' })),
      choice('choose-guayota-profile', 'Soy una chica', 'trainer-name', action('selectTrainerAvatar', { avatarId: 'guayota' })),
    ] }),
    cue('trainer-name', 'parlanchin', 'Este es el nombre que pondré en tu ficha. Puedes cambiarlo ahora si quieres.', { textInput: {
      inputId: 'trainer-display-name-profile',
      label: 'Nombre del entrenador',
      variableId: 'player.name',
      maxLength: 18,
      submitLabel: 'Confirmar nombre',
      nextCueId: 'completed',
      legacyAction: 'saveTrainerNameAndAccept',
    } }),
    cue('completed', 'explicando', '¡Perfecto! Ya puedo dirigirme a ti como es debido.', { legacyAction: action('completeSequence'), outcomeId: 'completed' }),
  ]),
  document('narrative:professor-camphor:forest-emergency', 'Emergencia en el bosque', true, [
    cue('emergency-call', 'parlanchin', '¡Tenemos una emergencia en el Bosque de Tegueste! Tres Pokémon me han rodeado y están intentando llevarse las provisiones.', { nextCueId: 'choose-companion' }),
    cue('choose-companion', 'explicando', 'Necesito que vengas enseguida. Elige un compañero de campo y confirma la salida; mantendré abierta la comunicación.', { legacyAction: action('completeSequence'), outcomeId: 'completed' }),
  ]),
];

fs.mkdirSync(target, { recursive: true });
for (const value of documents) {
  const name = `${value.conversationId.split(':').at(-1)}.conversation.json`;
  fs.writeFileSync(path.join(target, name), `${JSON.stringify(value, null, 2)}\n`);
}
console.log(`Conversaciones de Alcanfor migradas: ${documents.length}.`);
