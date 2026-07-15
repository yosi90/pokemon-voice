import type {
  AppearanceDiscoveryRecordV1,
  FormDiscoveryRecordV1,
  PokemonSpeciesId,
  StableId,
} from '../../../packages/contracts/src/index.js';

export type PokemonVariantGalleryKind = 'form' | 'appearance';

export interface PokemonVariantGalleryItem {
  id: StableId;
  formId: string;
  kind: PokemonVariantGalleryKind;
  label: string;
  isDefault: boolean;
  discoveredAt?: string;
  originMapId?: StableId;
  originMissionId?: StableId;
  originEncounterId?: StableId;
  noteIds: StableId[];
}

function humanizeStableId(id: string) {
  const fragment = id.split(':').at(-1) || id;
  return fragment.replace(/[-_]+/g, ' ').replace(/^./, letter => letter.toUpperCase());
}

function formLabel(formId: string) {
  const name = humanizeStableId(formId);
  return name.toLowerCase() === 'default' ? 'Forma habitual' : `Forma ${name}`;
}

export function formatVariantOrigin(item: PokemonVariantGalleryItem) {
  if (item.originMapId) return `Mapa · ${humanizeStableId(item.originMapId)}`;
  if (item.originMissionId) return `Misión · ${humanizeStableId(item.originMissionId)}`;
  if (item.originEncounterId) return `Encuentro · ${humanizeStableId(item.originEncounterId)}`;
  return item.isDefault ? 'Registro de Pokédex' : 'Procedencia desconocida';
}

export function formatVariantNote(noteId: StableId) {
  return humanizeStableId(noteId);
}

export function buildPokemonVariantGallery({
  speciesId,
  forms,
  appearances,
}: {
  speciesId: PokemonSpeciesId;
  forms: readonly FormDiscoveryRecordV1[];
  appearances: readonly AppearanceDiscoveryRecordV1[];
}): PokemonVariantGalleryItem[] {
  const defaultFormId = `pokemon-form:${speciesId}:default`;
  const items: PokemonVariantGalleryItem[] = [{
    id: defaultFormId,
    formId: defaultFormId,
    kind: 'form',
    label: 'Forma habitual',
    isDefault: true,
    noteIds: [],
  }];

  for (const record of forms) {
    if (record.speciesId !== speciesId || record.formId === defaultFormId) continue;
    items.push({
      id: record.formId,
      formId: record.formId,
      kind: 'form',
      label: formLabel(record.formId),
      isDefault: false,
      discoveredAt: record.discoveredAt,
      originMapId: record.originMapId,
      originMissionId: record.originMissionId,
      originEncounterId: record.originEncounterId,
      noteIds: [...record.noteIds],
    });
  }

  for (const record of appearances) {
    if (record.speciesId !== speciesId) continue;
    items.push({
      id: record.appearanceId,
      formId: record.formId,
      kind: 'appearance',
      label: humanizeStableId(record.appearanceId),
      isDefault: false,
      discoveredAt: record.discoveredAt,
      originMapId: record.originMapId,
      originMissionId: record.originMissionId,
      originEncounterId: record.originEncounterId,
      noteIds: [...record.noteIds],
    });
  }

  return items;
}
