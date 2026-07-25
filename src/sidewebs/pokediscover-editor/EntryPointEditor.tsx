import { useMemo, useState } from 'react';
import type { AdventureMapV2 } from '../../../packages/contracts/src/index.js';
import {
  assignPokeDiscoverMissionEntry,
  upsertPokeDiscoverEntryPoint,
} from '../../domain/tools/pokeDiscoverEditorGeometry.js';
import {
  slugifyEditorLabel,
  type PokeDiscoverRoomRegistration,
} from '../../domain/tools/pokeDiscoverEditorProject.js';
import { readPokeDiscoverEditorAnchors } from '../../domain/tools/pokeDiscoverEditorTiledReferences.js';
import type { PokeDiscoverWorkspaceSnapshot } from '../../domain/tools/pokeDiscoverEditorWorkspace.js';

export function EntryPointEditor({
  snapshot,
  registrations,
  onAdventureChange,
}: {
  snapshot: PokeDiscoverWorkspaceSnapshot;
  registrations: PokeDiscoverRoomRegistration[];
  onAdventureChange: (adventure: AdventureMapV2, description: string) => void;
}) {
  const adventure = snapshot.adventure;
  const [selectedId, setSelectedId] = useState(adventure.entryPoints?.[0]?.entryPointId ?? '');
  const [newLabel, setNewLabel] = useState('Nueva entrada');
  const selected = adventure.entryPoints?.find(entry => entry.entryPointId === selectedId);
  const firstRegistration = registrations[0];
  const roomId = selected?.roomId ?? firstRegistration?.roomId ?? '';
  const anchorsByRoom = useMemo(() => new Map(registrations.map(registration => [
    registration.roomId,
    readPokeDiscoverEditorAnchors(snapshot.tilemapsByFileName[registration.fileName])
      .filter(anchor => anchor.anchorClass === 'PlayerSpawn'),
  ])), [registrations, snapshot.tilemapsByFileName]);
  const roomAnchors = anchorsByRoom.get(roomId) ?? [];
  const anchorId = selected?.anchorId ?? roomAnchors[0]?.anchorId ?? '';
  const creatableRegistration = registrations.find(registration => (
    (anchorsByRoom.get(registration.roomId)?.length ?? 0) > 0
  ));

  const createEntry = () => {
    if (!creatableRegistration) return;
    const anchors = anchorsByRoom.get(creatableRegistration.roomId) ?? [];
    if (!anchors.length) return;
    const preferred = `entry-point:${slugifyEditorLabel(newLabel)}`;
    const used = new Set((adventure.entryPoints ?? []).map(entry => entry.entryPointId));
    let entryPointId = preferred;
    for (let suffix = 2; used.has(entryPointId); suffix += 1) entryPointId = `${preferred}-${suffix}`;
    onAdventureChange(upsertPokeDiscoverEntryPoint(adventure, {
      schemaVersion: 1,
      entryPointId,
      label: newLabel.trim() || 'Nueva entrada',
      roomId: creatableRegistration.roomId,
      anchorId: anchors[0].anchorId,
    }), 'Crear punto de entrada');
    setSelectedId(entryPointId);
  };

  const updateSelected = (update: Partial<NonNullable<AdventureMapV2['entryPoints']>[number]>) => {
    if (!selected) return;
    const next = { ...selected, ...update };
    if (update.roomId) {
      next.anchorId = anchorsByRoom.get(update.roomId)?.[0]?.anchorId ?? '';
    }
    onAdventureChange(upsertPokeDiscoverEntryPoint(adventure, next), 'Editar punto de entrada');
  };

  return (
    <section className="editor-entry-points" aria-label="Puntos de entrada">
      <header>
        <div>
          <span className="editor-eyebrow">Llegadas al mapa</span>
          <h2>Entradas de misiones y expedición libre</h2>
        </div>
        <span>{adventure.entryPoints?.length ?? 0} entradas</span>
      </header>
      <div className="editor-entry-points__layout">
        <aside>
          <label><span>Nombre de la entrada</span><input value={newLabel} onChange={event => setNewLabel(event.target.value)} /></label>
          <button type="button" disabled={!creatableRegistration} onClick={createEntry}>Crear entrada</button>
          {!creatableRegistration ? <p>Dibuja primero una entrada del jugador en una habitación.</p> : null}
          <div className="editor-entry-points__list">
            {(adventure.entryPoints ?? []).map(entry => (
              <button
                key={entry.entryPointId}
                type="button"
                aria-pressed={selected?.entryPointId === entry.entryPointId}
                onClick={() => setSelectedId(entry.entryPointId)}
              >
                <strong>{entry.label}</strong>
                <small>{registrations.find(item => item.roomId === entry.roomId)?.fileName ?? entry.roomId}</small>
              </button>
            ))}
          </div>
        </aside>
        <div>
          {selected ? (
            <div className="editor-entry-points__form">
              <label><span>Nombre visible</span><input value={selected.label} onChange={event => updateSelected({ label: event.target.value })} /></label>
              <label><span>Habitación</span><select value={selected.roomId} onChange={event => updateSelected({ roomId: event.target.value })}>
                {registrations.map(registration => <option key={registration.roomId} value={registration.roomId}>{registration.fileName}</option>)}
              </select></label>
              <label><span>Ancla de llegada</span><select value={anchorId} onChange={event => updateSelected({ anchorId: event.target.value })}>
                {(anchorsByRoom.get(selected.roomId) ?? []).map(anchor => <option key={anchor.anchorId} value={anchor.anchorId}>{anchor.anchorId}</option>)}
              </select></label>
              <details><summary>Detalles avanzados</summary><code>{selected.entryPointId}</code></details>
            </div>
          ) : <p>Crea una entrada para asociar una llegada del jugador.</p>}
          <div className="editor-entry-points__assignments">
            <h3>Uso de las entradas</h3>
            {adventure.missionIds.map((missionId, index) => {
              const assignment = adventure.missionEntryPoints?.find(item => item.missionId === missionId);
              return <label key={missionId}><span>Misión {index + 1}</span><select value={assignment?.entryPointId ?? ''} onChange={event => onAdventureChange(assignPokeDiscoverMissionEntry(adventure, {
                schemaVersion: 1,
                missionId,
                entryPointId: event.target.value,
              }), 'Asignar entrada de misión')}>
                <option value="">Sin asignar</option>
                {(adventure.entryPoints ?? []).map(entry => <option key={entry.entryPointId} value={entry.entryPointId}>{entry.label}</option>)}
              </select></label>;
            })}
            <label><span>Expedición libre</span><select value={adventure.freeExpeditionEntryPointId ?? ''} onChange={event => onAdventureChange({
              ...adventure,
              freeExpeditionEntryPointId: event.target.value || undefined,
            }, 'Asignar entrada de expedición libre')}>
              <option value="">Sin asignar</option>
              {(adventure.entryPoints ?? []).map(entry => <option key={entry.entryPointId} value={entry.entryPointId}>{entry.label}</option>)}
            </select></label>
          </div>
        </div>
      </div>
    </section>
  );
}
