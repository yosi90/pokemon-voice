import type {
  PokeDiscoverShopContentV1,
  ShopOfferV1,
} from '../../../packages/contracts/src/index.js';

export const POKE_DISCOVER_SHOP_CONTENT = Object.freeze([
  {
    schemaVersion: 1,
    category: 'tool',
    contentId: 'tool:shovel',
    toolId: 'tool:shovel',
    displayName: 'Pala de campo',
    description: 'Una pala resistente para examinar terrenos blandos y accesos enterrados.',
    unlockHint: 'Puede revelar entradas subterráneas y encargos relacionados con fósiles.',
    unlocksMissionIds: ['mission:kanto:fossil-tunnel'],
    capabilities: [{ id: 'dig', strength: 1, tags: ['excavation'] }],
  },
  {
    schemaVersion: 1,
    category: 'tool',
    contentId: 'tool:archaeology-brush',
    toolId: 'tool:archaeology-brush',
    displayName: 'Cepillo de arqueología',
    description: 'Permite limpiar inscripciones y objetos frágiles sin dañarlos.',
    unlockHint: 'Será útil en ruinas, yacimientos y futuras investigaciones de Unown.',
    unlocksMissionIds: ['mission:johto:unown-ruins-survey'],
    capabilities: [{ id: 'archaeology', strength: 1, tags: ['ruins', 'delicate-cleaning'] }],
  },
  {
    schemaVersion: 1,
    category: 'tool',
    contentId: 'tool:boat',
    toolId: 'tool:boat',
    displayName: 'Bote plegable',
    description: 'Un bote ligero que cabe entre el material de expedición.',
    unlockHint: 'Permite cruzar agua sin depender de un compañero con Surf.',
    capabilities: [{ id: 'surf', strength: 1, tags: ['water-crossing'] }],
  },
  {
    schemaVersion: 1,
    category: 'keyItem',
    contentId: 'key-item:dragon-scale',
    keyItemId: 'key-item:dragon-scale',
    displayName: 'Escama Dragón',
    description: 'Un objeto excepcional que algunos Pokémon reconocen de inmediato.',
    unlockHint: 'Cuenta como requisito narrativo pasivo y no ocupa el espacio de herramienta.',
  },
  {
    schemaVersion: 1,
    category: 'permission',
    contentId: 'permission:special-phenomena-fieldwork',
    permissionId: 'permission:special-phenomena-fieldwork',
    displayName: 'Licencia de fenómenos especiales',
    description: 'Autoriza expediciones opcionales sobre fenómenos Pokémon poco comunes.',
    unlockHint: 'Podrá habilitar encargos de formas alternativas, paradojas y especies especiales.',
    discoveryTags: ['alternate-form', 'paradox', 'special-species'],
  },
  {
    schemaVersion: 1,
    category: 'cosmetic',
    contentId: 'cosmetic:field-avatar-palette',
    cosmeticId: 'cosmetic:field-avatar-palette',
    displayName: 'Paleta de expedición',
    description: 'Una combinación de colores alternativa para tu avatar de campo.',
    unlockHint: 'Cambio puramente visual.',
  },
  {
    schemaVersion: 1,
    category: 'cosmetic',
    contentId: 'cosmetic:pokedex-ball-theme',
    cosmeticId: 'cosmetic:pokedex-ball-theme',
    displayName: 'Tema de Poké Balls',
    description: 'Una apariencia alternativa para la Pokédex y sus Poké Balls.',
    unlockHint: 'Cambio puramente visual.',
  },
] as const satisfies readonly PokeDiscoverShopContentV1[]);

export const POKE_DISCOVER_SHOP_OFFERS = Object.freeze([
  { schemaVersion: 1, offerId: 'offer:tool:shovel', category: 'tool', contentId: 'tool:shovel', discoveryPointCost: 90, optionalContentOnly: true },
  { schemaVersion: 1, offerId: 'offer:tool:archaeology-brush', category: 'tool', contentId: 'tool:archaeology-brush', discoveryPointCost: 110, optionalContentOnly: true },
  { schemaVersion: 1, offerId: 'offer:tool:boat', category: 'tool', contentId: 'tool:boat', discoveryPointCost: 150, optionalContentOnly: true },
  { schemaVersion: 1, offerId: 'offer:key-item:dragon-scale', category: 'keyItem', contentId: 'key-item:dragon-scale', discoveryPointCost: 160, optionalContentOnly: true },
  { schemaVersion: 1, offerId: 'offer:permission:special-phenomena-fieldwork', category: 'permission', contentId: 'permission:special-phenomena-fieldwork', discoveryPointCost: 220, optionalContentOnly: true },
  { schemaVersion: 1, offerId: 'offer:cosmetic:field-avatar-palette', category: 'cosmetic', contentId: 'cosmetic:field-avatar-palette', discoveryPointCost: 120, optionalContentOnly: true },
  { schemaVersion: 1, offerId: 'offer:cosmetic:pokedex-ball-theme', category: 'cosmetic', contentId: 'cosmetic:pokedex-ball-theme', discoveryPointCost: 180, optionalContentOnly: true },
] as const satisfies readonly ShopOfferV1[]);

const contentById = new Map<string, PokeDiscoverShopContentV1>(
  POKE_DISCOVER_SHOP_CONTENT.map(content => [content.contentId, content]),
);

export function getPokeDiscoverShopContent(contentId: string) {
  return contentById.get(contentId);
}
