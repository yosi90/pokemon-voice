import type {
  NarrativeConversationManifestV1,
  NarrativeConversationV1,
} from '../../../packages/contracts/src/index.js';
import { migrateNarrativeSequence } from '../../domain/narrative/visualNovel.js';
import { PROFESSOR_NARRATIVE_SEQUENCES } from '../../domain/narrative/professorIntroduction.js';

let catalog = new Map<string, NarrativeConversationV1>();
let loading: Promise<ReadonlyMap<string, NarrativeConversationV1>> | undefined;

function assetUrl(path: string, baseUrl: string) {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path, new URL(normalized, window.location.href)).href;
}

function fallbackCatalog() {
  return new Map(Object.values(PROFESSOR_NARRATIVE_SEQUENCES).map(sequence => {
    const conversation = migrateNarrativeSequence(sequence);
    return [conversation.conversationId, conversation] as const;
  }));
}

export async function loadNarrativeConversationCatalog(baseUrl: string) {
  if (catalog.size) return catalog as ReadonlyMap<string, NarrativeConversationV1>;
  if (loading) return loading;
  loading = (async () => {
    try {
      const manifestResponse = await fetch(assetUrl(
        'assets/adventure/narratives/manifest.v1.json',
        baseUrl,
      ));
      if (!manifestResponse.ok) throw new Error(`Narrativa ${manifestResponse.status}.`);
      const manifest = await manifestResponse.json() as NarrativeConversationManifestV1;
      const documents = await Promise.all(manifest.conversations.map(async entry => {
        const response = await fetch(assetUrl(entry.documentPath, baseUrl));
        if (!response.ok) throw new Error(`${entry.documentPath}: ${response.status}.`);
        return response.json() as Promise<NarrativeConversationV1>;
      }));
      catalog = new Map(documents.map(document => [document.conversationId, document]));
    } catch {
      catalog = fallbackCatalog();
    }
    return catalog;
  })();
  return loading;
}

export async function getNarrativeConversation(
  conversationId: string,
  baseUrl = import.meta.env.BASE_URL,
) {
  return (await loadNarrativeConversationCatalog(baseUrl)).get(conversationId);
}
