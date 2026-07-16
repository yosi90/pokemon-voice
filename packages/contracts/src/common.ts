export type ISODateString = string;
export type StableId = string;
export type PokemonSpeciesId = number;
export type PokemonFormId = string;
export type PokemonAppearanceId = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface VersionedContractV1 {
  schemaVersion: 1;
}

export interface Vector2V1 {
  x: number;
  y: number;
}
