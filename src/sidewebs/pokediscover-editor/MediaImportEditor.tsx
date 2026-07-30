import { useEffect, useState } from 'react';
import type {
  AdventureMediaManifestV1,
  CharacterSpriteManifestV1,
} from '../../../packages/contracts/src/index.js';
import {
  createPokeDiscoverAudioAsset,
  createPokeDiscoverEffectAsset,
  importPokeDiscoverCharacterFile,
  importPokeDiscoverMountFile,
  importPokeDiscoverMediaFile,
  validatePokeDiscoverMediaFile,
} from '../../domain/tools/pokeDiscoverEditorMedia.js';
import type { PokeDiscoverDirectoryHandle } from '../../domain/tools/pokeDiscoverEditorWorkspace.js';

export function MediaImportEditor({
  rootHandle,
  mediaManifest,
  characterManifest,
  onImported,
}: {
  rootHandle?: PokeDiscoverDirectoryHandle;
  mediaManifest: AdventureMediaManifestV1;
  characterManifest: CharacterSpriteManifestV1;
  onImported: () => void;
}) {
  const [kind, setKind] = useState<'effect' | 'audio' | 'character' | 'mount'>('effect');
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [assetId, setAssetId] = useState('');
  const [source, setSource] = useState('Importado desde el configurador');
  const [frameWidth, setFrameWidth] = useState(16);
  const [frameHeight, setFrameHeight] = useState(16);
  const [columns, setColumns] = useState(1);
  const [rows, setRows] = useState(1);
  const [frameDurationMs, setFrameDurationMs] = useState(100);
  const [audioKind, setAudioKind] = useState<'effect' | 'music' | 'voice'>('effect');
  const [appearanceId, setAppearanceId] = useState('appearance:trainer:imported');
  const [avatarId, setAvatarId] = useState<'achaman' | 'guayota'>('achaman');
  const [locomotionMode, setLocomotionMode] = useState<'walk' | 'swim'>('walk');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  const importAsset = async () => {
    if (!rootHandle) {
      setMessage('Abre la raíz de pokemon voice para importar recursos globales.');
      return;
    }
    if (!file) {
      setMessage('Selecciona primero un archivo.');
      return;
    }
    const validation = validatePokeDiscoverMediaFile(file, kind);
    if (validation) {
      setMessage(validation);
      return;
    }
    try {
      if (kind === 'effect') {
        await importPokeDiscoverMediaFile(rootHandle, file, createPokeDiscoverEffectAsset({
          assetId,
          path: file.name,
          frameWidth,
          frameHeight,
          columns,
          rows,
          frameDurationMs,
          source,
        }));
      } else if (kind === 'audio') {
        await importPokeDiscoverMediaFile(rootHandle, file, createPokeDiscoverAudioAsset({
          assetId,
          path: file.name,
          audioKind,
          source,
        }));
      } else if (kind === 'character') {
        const existingAppearance = characterManifest.appearances?.find(candidate => (
          candidate.appearanceId === appearanceId
        ));
        const walkAssetId = locomotionMode === 'walk'
          ? assetId
          : existingAppearance?.modes.walk;
        if (!walkAssetId) throw new Error('Para añadir natación, la apariencia necesita primero un modo walk.');
        await importPokeDiscoverCharacterFile(rootHandle, file, {
          schemaVersion: 1,
          assetId,
          role: 'player',
          path: file.name,
          frameWidth,
          frameHeight,
          columns,
          rows: 4,
          directionRows: { down: 0, left: 1, right: 2, up: 3 },
          idleFrame: 0,
          walkFrames: Array.from({ length: columns }, (_, index) => index),
          frameDurationMs,
          appearanceId,
          avatarId,
          locomotionMode,
          source,
        }, existingAppearance ?? {
          schemaVersion: 1,
          appearanceId,
          avatarId,
          label: appearanceId.split(':').at(-1) ?? appearanceId,
          modes: { walk: walkAssetId },
        });
      } else {
        await importPokeDiscoverMountFile(rootHandle, file, {
          schemaVersion: 1,
          assetId,
          role: 'mount',
          path: file.name,
          frameWidth,
          frameHeight,
          columns,
          rows: 4,
          directionRows: { down: 0, left: 1, right: 2, up: 3 },
          idleFrame: 0,
          walkFrames: Array.from({ length: columns }, (_, index) => index),
          frameDurationMs,
          locomotionMode: 'swim',
          source,
        });
      }
      setMessage(`${assetId} se ha registrado sin sobrescribir recursos existentes.`);
      setFile(undefined);
      onImported();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo importar el recurso.');
    }
  };

  return <section className="editor-media-import">
    <header>
      <div><span className="editor-eyebrow">Catálogo global</span><h2>Importar recursos</h2></div>
      <span>{mediaManifest.assets.length} medios · {characterManifest.assets.length} personajes</span>
    </header>
    {!rootHandle ? <p role="alert">Este proyecto se abrió sin la raíz global. Usa Archivo → Abrir carpeta y elige <strong>pokemon voice</strong>.</p> : null}
    <div className="editor-media-import__form">
      <label><span>Familia</span><select value={kind} onChange={event => { setKind(event.target.value as typeof kind); setFile(undefined); }}>
        <option value="effect">Efecto PNG</option>
        <option value="audio">Audio</option>
        <option value="character">Personaje / apariencia</option>
        <option value="mount">Montura acuática</option>
      </select></label>
      <label><span>Archivo</span><input type="file" accept={kind === 'audio' ? '.wav,.ogg,.mp3,audio/*' : '.png,image/png'} onChange={event => setFile(event.target.files?.[0])} /></label>
      <label><span>ID estable</span><input value={assetId} placeholder={kind === 'audio'
        ? 'audio:forest:bubbles'
        : kind === 'effect'
          ? 'effect:bubble'
          : kind === 'mount'
            ? 'character:mount:lapras-surf'
            : 'character:trainer:achaman:swim'} onChange={event => setAssetId(event.target.value)} /></label>
      <label><span>Origen / créditos</span><input value={source} onChange={event => setSource(event.target.value)} /></label>
      {kind !== 'audio' ? <>
        <label><span>Frame ancho</span><input type="number" min="1" value={frameWidth} onChange={event => setFrameWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
        <label><span>Frame alto</span><input type="number" min="1" value={frameHeight} onChange={event => setFrameHeight(Math.max(1, Number(event.target.value) || 1))} /></label>
        <label><span>Columnas</span><input type="number" min="1" value={columns} onChange={event => setColumns(Math.max(1, Number(event.target.value) || 1))} /></label>
        {kind === 'effect' ? <label><span>Filas</span><input type="number" min="1" value={rows} onChange={event => setRows(Math.max(1, Number(event.target.value) || 1))} /></label> : null}
        <label><span>Duración frame (ms)</span><input type="number" min="1" value={frameDurationMs} onChange={event => setFrameDurationMs(Math.max(1, Number(event.target.value) || 1))} /></label>
      </> : <label><span>Uso</span><select value={audioKind} onChange={event => setAudioKind(event.target.value as typeof audioKind)}><option value="effect">Efecto</option><option value="music">Música</option><option value="voice">Voz</option></select></label>}
      {kind === 'character' ? <>
        <label><span>Apariencia</span><input list="character-appearances" value={appearanceId} onChange={event => setAppearanceId(event.target.value)} /><datalist id="character-appearances">{characterManifest.appearances?.map(appearance => <option key={appearance.appearanceId}>{appearance.appearanceId}</option>)}</datalist></label>
        <label><span>Avatar</span><select value={avatarId} onChange={event => setAvatarId(event.target.value as typeof avatarId)}><option value="achaman">Achamán</option><option value="guayota">Guayota</option></select></label>
        <label><span>Locomoción</span><select value={locomotionMode} onChange={event => setLocomotionMode(event.target.value as typeof locomotionMode)}><option value="walk">Caminar</option><option value="swim">Nadar</option></select></label>
      </> : null}
      {kind === 'mount' ? <p>La hoja debe tener cuatro filas: abajo, izquierda, derecha y arriba, con el pivote en la base.</p> : null}
    </div>
    {previewUrl && kind !== 'audio' ? <figure><img src={previewUrl} alt="Previsualización del recurso a importar" style={{ imageRendering: 'pixelated' }} /><figcaption>{file?.name}</figcaption></figure> : null}
    {kind === 'audio' && previewUrl ? <audio src={previewUrl} controls /> : null}
    <button type="button" disabled={!rootHandle || !file || !assetId.trim()} onClick={() => void importAsset()}>Importar al catálogo global</button>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
