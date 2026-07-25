import { useMemo, useState } from 'react';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  createPokeDiscoverEditorExportArtifacts,
  type PokeDiscoverEditorExportArtifact,
  verifyPokeDiscoverEditorExportRoundTrip,
} from '../../domain/tools/pokeDiscoverEditorExport.js';

const EXPORT_LABELS: Record<PokeDiscoverEditorExportArtifact['kind'], string> = {
  sidecar: 'Descargar proyecto',
  pmdManifest: 'Descargar catálogo de animaciones',
  characterManifest: 'Descargar manifiesto de personajes',
};

function downloadArtifact(artifact: PokeDiscoverEditorExportArtifact) {
  const url = URL.createObjectURL(new Blob([artifact.content], { type: artifact.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ProjectExportPanel({
  bundle,
  sidecarFileName,
  originalSidecarContent,
}: {
  bundle: LoadedAdventureMapBundle;
  sidecarFileName: string;
  originalSidecarContent: string;
}) {
  const [lastDownload, setLastDownload] = useState('');
  const artifacts = useMemo(() => createPokeDiscoverEditorExportArtifacts({
    adventure: bundle.adventure,
    sidecarFileName,
    pmdManifest: bundle.pmdManifest,
    characterManifest: bundle.characterManifest,
  }), [bundle, sidecarFileName]);
  const hasChanges = artifacts[0].content !== originalSidecarContent;
  const verifiedArtifacts = artifacts.filter(verifyPokeDiscoverEditorExportRoundTrip).length;

  const download = (artifact: PokeDiscoverEditorExportArtifact) => {
    downloadArtifact(artifact);
    setLastDownload(`${artifact.fileName} preparado para descargar.`);
  };

  return <section className="editor-export" aria-labelledby="editor-export-title">
    <header><div><span className="editor-eyebrow">Archivos PokeDiscover</span><h2 id="editor-export-title">Exportar proyecto</h2></div><span className={hasChanges ? 'has-changes' : ''}>{hasChanges ? 'Cambios en memoria' : 'Sin cambios'}</span></header>
    <p>Descarga una copia de los datos del juego y de sus mapas editables.</p>
    <div className={`editor-export__round-trip ${verifiedArtifacts === artifacts.length ? 'is-valid' : 'is-invalid'}`} role="status"><strong>{verifiedArtifacts === artifacts.length ? '✓ Round-trip JSON verificado' : 'Error de round-trip JSON'}</strong><span>{verifiedArtifacts}/{artifacts.length} artefactos estables</span></div>
    <ul>{artifacts.map(artifact => <li key={artifact.kind}>
      <div><strong>{artifact.fileName}</strong><small>{artifact.projectPath}</small></div>
      <button type="button" onClick={() => download(artifact)}>{EXPORT_LABELS[artifact.kind]}</button>
    </li>)}</ul>
    {lastDownload ? <p className="editor-export__status" role="status">{lastDownload}</p> : null}
  </section>;
}
