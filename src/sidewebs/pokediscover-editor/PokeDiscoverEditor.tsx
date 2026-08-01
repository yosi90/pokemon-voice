import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AdventureMapV3, PmdAnimationManifestV1 } from '../../../packages/contracts/src/index.js';
import {
  loadAdventureMapBundleFromData,
  type LoadedAdventureMapBundle,
} from '../../domain/maps/loadAdventureBundle.js';
import {
  addPokeDiscoverCollisionRectangle,
  connectPokeDiscoverRoomsBidirectionally,
  findPokeDiscoverGeometryReferences,
  type PokeDiscoverGeometryPoint,
  type PokeDiscoverWorldEdge,
} from '../../domain/tools/pokeDiscoverEditorGeometry.js';
import {
  applyPokeDiscoverImmediateRecipe,
  type PokeDiscoverAuthoringTransaction,
} from '../../domain/tools/pokeDiscoverEditorAuthoringRegistry.js';
import {
  auditPokeDiscoverAuthoringSnapshot,
  extendPokeDiscoverSanitationIssueOrder,
  findIntroducedPokeDiscoverValidationErrors,
  removePokeDiscoverPokemonPlacement,
  repairPokeDiscoverAuthoringIssue,
  type PokeDiscoverAuthoringIssue,
} from '../../domain/tools/pokeDiscoverEditorAuthoringAudit.js';
import {
  defaultPokeDiscoverMigrationComment,
  isPokeDiscoverEditorComment,
  replacePokeDiscoverTiledObjectWithComment,
} from '../../domain/tools/pokeDiscoverEditorComments.js';
import { inferPokemonAssetsFromAnchorName } from '../../domain/tools/pokeDiscoverRosterInference.js';
import { createPokeDiscoverMapEventFromComment } from '../../domain/tools/pokeDiscoverMapEventAuthoring.js';
import {
  synchronizeAdventureRequiredAssetIds,
  validateAdventureSectorRoster,
} from '../../domain/expeditions/adventureMapV3.js';
import { validateTiledAdventureBundle } from '../../domain/maps/tiledAdventureValidator.js';
import {
  readTiledCollisionShape,
  rectangleOverlapsCollision,
} from '../../domain/maps/tiledCollisionGeometry.js';
import {
  commitPokeDiscoverEditorHistory,
  applyPokeDiscoverWorldOrganization,
  fileBaseName,
  redoPokeDiscoverEditorHistory,
  removePokeDiscoverTiledObject,
  updatePokeDiscoverTiledObject,
  undoPokeDiscoverEditorHistory,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from '../../domain/tools/pokeDiscoverEditorProject.js';
import {
  attachPokeDiscoverWorkspaceDirectory,
  displayPokeDiscoverRoomLabel,
  downloadPokeDiscoverWorkspaceCopy,
  findPokeDiscoverWorkspaceConflicts,
  getPokeDiscoverWorkspaceDirtyFiles,
  inspectPokeDiscoverWorkspaceFiles,
  markPokeDiscoverWorkspaceExported,
  migratePokeDiscoverWorkspaceToV3,
  openPokeDiscoverWorkspace,
  readPokeDiscoverDirectory,
  requestPokeDiscoverDirectoryWritePermission,
  savePokeDiscoverWorkspace,
  type PokeDiscoverDirectoryHandle,
  type PokeDiscoverProjectMetadata,
  type PokeDiscoverWorkspace,
  type PokeDiscoverWorkspaceSnapshot,
  type PokeDiscoverWorkspaceSourceFile,
} from '../../domain/tools/pokeDiscoverEditorWorkspace.js';
import {
  discoverPokeDiscoverProjectFiles,
  discoverPokeDiscoverProjectRoot,
  withPokeDiscoverMissionManifestTransaction,
  type PokeDiscoverProjectRoot,
  type PokeDiscoverRootProject,
} from '../../domain/tools/pokeDiscoverEditorProjectRoot.js';
import {
  createPokeDiscoverMovementRoute,
  lastPokeDiscoverMovementPoint,
  linkedPokeDiscoverMovementSequences,
  movePokeDiscoverMovementPath,
  type PokeDiscoverMovementRouteDraft,
} from '../../domain/tools/pokeDiscoverMovementAuthoring.js';
import { auditPokeDiscoverEditorProject } from '../../domain/tools/pokeDiscoverEditorDiagnostics.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import {
  createPokeDiscoverRecentWorkspaceSources,
  readPokeDiscoverRecentFolder,
  rememberPokeDiscoverRecentFolder,
  type PokeDiscoverRecentFolder,
} from '../../domain/tools/pokeDiscoverEditorRecentFolder.js';
import { applyEditorAdventure, AmbientBeatEditor } from './AmbientBeatEditor.js';
import { CatalogExplorer } from './CatalogExplorer.js';
import {
  ContentPlacementEditor,
  PlacementPropertiesEditor,
} from './ContentPlacementEditor.js';
import { EditorWindow } from './EditorWindow.js';
import { EncounterWorldEditor } from './EncounterWorldEditor.js';
import { EntryPointEditor } from './EntryPointEditor.js';
import { GeometryPropertiesEditor } from './GeometryPropertiesEditor.js';
import {
  MapAuthoringCanvas,
  POKEDISCOVER_CANVAS_TOOLS,
  type PokeDiscoverCellCommand,
  type PokeDiscoverCellSelection,
} from './MapAuthoringCanvas.js';
import { MapEventFromCommentEditor } from './MapEventFromCommentEditor.js';
import { MovementAndEventsEditor } from './MovementAndEventsEditor.js';
import { NarrativeConfigurationEditor } from './NarrativeConfigurationEditor.js';
import { TerrainAndLocationsEditor } from './TerrainAndLocationsEditor.js';
import { MediaImportEditor } from './MediaImportEditor.js';
import { UnifiedEventEditor } from './UnifiedEventEditor.js';
import { OrphanPokemonAnchorRepairEditor } from './OrphanPokemonAnchorRepairEditor.js';
import { ProgressSimulationEditor } from './ProgressSimulationEditor.js';
import { ProjectDiagnosticsPanel } from './ProjectDiagnosticsPanel.js';
import { RequirementEditor } from './RequirementEditor.js';
import { resolvePokeDiscoverToolUrl, ToolNavigation } from '../shared/ToolNavigation.js';
import { ResearchCoverageMatrix } from './ResearchCoverageMatrix.js';
import { TiledReferenceExplorer } from './TiledReferenceExplorer.js';
import { SidecarContentPropertiesEditor } from './SidecarContentPropertiesEditor.js';
import { SectorRosterEditor } from './SectorRosterEditor.js';
import { WorldAuthoringCanvas } from './WorldAuthoringCanvas.js';
import {
  CellContentDraftEditor,
  type PokeDiscoverCellContentKind,
  type PokeDiscoverCellWizardValue,
} from './CellContentDraftEditor.js';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type MainView = 'room' | 'world' | 'organize';
type PendingNavigation = {
  message: string;
  action: () => void | Promise<void>;
};
type PokeDiscoverDirectoryPicker = (options?: {
  id?: string;
  mode?: 'read' | 'readwrite';
}) => Promise<PokeDiscoverDirectoryHandle>;
type DirectAuthoringGesture = 'direct' | 'shift';
type UtilityId =
  | 'roster'
  | 'placements'
  | 'encounters'
  | 'scenes'
  | 'entries'
  | 'rules'
  | 'narrative'
  | 'terrain'
  | 'events'
  | 'media'
  | 'catalog'
  | 'simulation'
  | 'coverage'
  | 'review'
  | 'advanced';

const UTILITY_TITLES: Record<UtilityId, string> = {
  roster: 'Reparto del sector',
  placements: 'Colocaciones',
  encounters: 'Encuentros',
  scenes: 'Escenas y movimiento',
  entries: 'Entradas del jugador',
  rules: 'Reglas',
  narrative: 'Investigación y narrativa',
  terrain: 'Terreno y lugares',
  events: 'Eventos y peligros',
  media: 'Importar recursos',
  catalog: 'Catálogo',
  simulation: 'Simulación',
  coverage: 'Cobertura de investigación',
  review: 'Revisión del proyecto',
  advanced: 'Datos avanzados',
};

const INITIAL_WINDOWS: Record<UtilityId, boolean> = {
  roster: false,
  placements: false,
  encounters: false,
  scenes: false,
  entries: false,
  rules: false,
  narrative: false,
  terrain: false,
  events: false,
  media: false,
  catalog: false,
  simulation: false,
  coverage: false,
  review: false,
  advanced: false,
};

const DIRECT_AUTHORING_GESTURE_STORAGE_KEY = 'pokediscover-editor-direct-authoring-gesture';

function projectPublicBaseUrl() {
  return new URL('../../', window.location.href).href;
}

function snapshotBundle(
  current: LoadedAdventureMapBundle,
  workspace: PokeDiscoverWorkspace,
) {
  const snapshot = workspace.history.present;
  const registrationsByRoom = new Map(snapshot.registrations.map(item => [item.sectorId, item]));
  const withAdventure = applyEditorAdventure(current, snapshot.adventure);
  return {
    ...withAdventure,
    missionDocument: snapshot.missionDocument,
    sectors: withAdventure.sectors.map(sectorBundle => {
      const registration = registrationsByRoom.get(sectorBundle.sector.sectorId);
      const source = registration ? snapshot.tilemapsByFileName[registration.fileName] : undefined;
      return source ? {
        ...sectorBundle,
        tilemap: {
          ...source,
          // El cargador ya ha resuelto TSX/TSJ e imágenes; las capas editables proceden del documento fuente.
          tilesets: sectorBundle.tilemap.tilesets,
        },
      } : sectorBundle;
    }),
  };
}

function DesktopMenu({
  label,
  open,
  onOpen,
  children,
}: {
  label: string;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const commandsRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const commands = commandsRef.current;
    if (!commands || !open) return undefined;
    const measure = () => setHasOverflow(commands.scrollWidth > commands.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(commands);
    requestAnimationFrame(measure);
    return () => observer.disconnect();
  }, [open]);
  return (
    <div className="editor-menu">
      <button type="button" aria-pressed={open} onClick={() => { setShowAll(false); onOpen(); }}>{label}</button>
      {open ? <div className={`editor-menu__popover${showAll ? ' is-expanded' : ''}`} role="menu">
        <div ref={commandsRef} className="editor-ribbon-commands">{children}</div>
        {hasOverflow ? <button type="button" className="editor-ribbon-more" onClick={() => setShowAll(value => !value)}>
          Ver todas
        </button> : null}
      </div> : null}
    </div>
  );
}

function MenuAction({
  children,
  shortcut,
  disabled,
  pressed,
  onClick,
}: {
  children: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return <button type="button" disabled={disabled} aria-pressed={pressed} onClick={onClick}>
    <span>{children}</span>{shortcut ? <kbd>{shortcut}</kbd> : null}
  </button>;
}

function SanitationIssueDetails({
  issue,
  onRepair,
  customRepair,
}: {
  issue: PokeDiscoverAuthoringIssue;
  onRepair: () => void;
  customRepair?: ReactNode;
}) {
  if (issue.kind === 'roster') return null;
  const coordinate = (value: number | undefined) => {
    const normalized = Math.trunc((value ?? 0) * 100) / 100;
    return Object.is(normalized, -0) ? '0' : String(normalized);
  };
  const position = `x ${coordinate(issue.position?.x)} · y ${coordinate(issue.position?.y)}${
    issue.position?.width || issue.position?.height
      ? ` · ${coordinate(issue.position.width)}×${coordinate(issue.position.height)} px`
      : ' · punto'
  }`;
  const metadata = [
    { label: 'Elemento', value: `Objeto Tiled #${issue.objectId}` },
    { label: 'Capa', value: issue.layerName ?? 'Sin capa identificada' },
    { label: 'Posición', value: position },
    { label: 'Nombre actual', value: issue.currentName || '(vacío)', code: true },
    { label: 'Clase actual', value: issue.currentClass || '(vacía)', code: true },
  ];
  return <section className="editor-sanitation-resolution" aria-label="Resolución de la incidencia">
    {issue.objectId !== undefined ? <dl className="editor-sanitation-object">
      {metadata.map(item => <div
        className={item.value.length > 32 ? 'is-wide' : undefined}
        key={item.label}
      >
        <dt>{item.label}</dt>
        <dd>{item.code ? <code>{item.value}</code> : item.value}</dd>
      </div>)}
    </dl> : null}

    {issue.kind === 'pending-transition-ready' ? <fieldset>
      <legend>El sector de destino ya está disponible</legend>
      <p>
        La conexión pendiente puede completarse ahora. Se crearán automáticamente
        la ida, la vuelta y sus extremos en ambos sectores.
      </p>
      <button type="button" className="is-primary" onClick={onRepair}>
        Crear conexión
      </button>
    </fieldset> : issue.kind === 'pending-transition' ? <fieldset>
      <legend>Conexión pendiente</legend>
      <p>
        El sector de destino todavía no existe. Se conservará la posición como una
        nota del mapa y la conexión funcional se creará cuando estén disponibles ambos sectores.
      </p>
      <button type="button" className="is-primary" onClick={onRepair}>
        Guardar para más tarde
      </button>
    </fieldset> : issue.kind === 'unlinked-transition' ? <fieldset>
      <legend>Conexión encontrada</legend>
      <p>
        Los bordes coinciden con un sector contiguo. Se crearán automáticamente
        la ida y la vuelta.
      </p>
      <button type="button" className="is-primary" onClick={onRepair}>
        Corregir y continuar
      </button>
    </fieldset> : issue.kind === 'shared-anchor' ? <fieldset>
      <legend>Reparación propuesta</legend>
      <p>
        Se creará una ancla independiente para cada colocación, conservando exactamente
        la posición actual.
      </p>
      <button type="button" className="is-primary" onClick={onRepair}>
        Corregir y continuar
      </button>
    </fieldset> : issue.canRepair && issue.expectedName && issue.expectedClass ? <fieldset>
      <legend>Reparación propuesta</legend>
      <p>
        Para conservar este elemento se aplicarán automáticamente estos valores.
        No necesitan editarse.
      </p>
      <dl className="editor-sanitation-derived-values">
        <div>
          <dt>ID resultante</dt>
          <dd><code>{issue.expectedName}</code></dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{issue.expectedClass}</dd>
        </div>
      </dl>
      <button type="button" className="is-primary" onClick={onRepair}>
        Corregir y continuar
      </button>
    </fieldset> : customRepair ?? (
      <p className="editor-sanitation-no-repair">
        {issue.canDelete
          ? 'Esta ancla estaba huérfana en el sistema anterior y no puede traducirse al nuevo, por lo que debe eliminarse.'
          : 'Este elemento no puede traducirse automáticamente al nuevo sistema y necesita una corrección antes de continuar.'}
      </p>
    )}
  </section>;
}

function SanitationCommentEditor({
  text,
  onChange,
}: {
  text: string;
  onChange: (text: string) => void;
}) {
  return <section className="editor-sanitation-delete" aria-label="Retirada del elemento">
    <label>
      <span>Comentario para conservar en el sector</span>
      <textarea
        value={text}
        onChange={event => onChange(event.target.value)}
        placeholder="Describe por qué se eliminó este elemento"
      />
    </label>
  </section>;
}

export function PokeDiscoverEditor() {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const recentFolderRestoreStartedRef = useRef(false);
  const pendingCreationRef = useRef<{
    files: PokeDiscoverWorkspaceSourceFile[];
    directoryHandle?: PokeDiscoverDirectoryHandle;
    projectName?: string;
  } | undefined>(undefined);
  const titleClosingRef = useRef(false);
  const [workspace, setWorkspace] = useState<PokeDiscoverWorkspace>();
  const [projectRoot, setProjectRoot] = useState<PokeDiscoverProjectRoot>();
  const [bundle, setBundle] = useState<LoadedAdventureMapBundle>();
  const [sectorId, setRoomId] = useState('');
  const [view, setView] = useState<MainView>('room');
  const [mode, setMode] = useState<'design' | 'test'>('design');
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [message, setMessage] = useState('Abre una carpeta para empezar.');
  const [menu, setMenu] = useState<string | undefined>('map');
  const [editingTitle, setEditingTitle] = useState(false);
  const [directAuthoringGesture, setDirectAuthoringGesture] = useState<DirectAuthoringGesture>(() => {
    try {
      return window.localStorage.getItem(DIRECT_AUTHORING_GESTURE_STORAGE_KEY) === 'shift'
        ? 'shift'
        : 'direct';
    } catch {
      return 'direct';
    }
  });
  const [titleDraft, setTitleDraft] = useState('');
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [windowOrder, setWindowOrder] = useState<UtilityId[]>(Object.keys(INITIAL_WINDOWS) as UtilityId[]);
  const [creationMetadata, setCreationMetadata] = useState<PokeDiscoverProjectMetadata>();
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [activePlacementId, setActivePlacementId] = useState('');
  const [inspectorPlacementId, setInspectorPlacementId] = useState('');
  const [inspectorObjectId, setInspectorObjectId] = useState<number>();
  const [eventCommentObjectId, setEventCommentObjectId] = useState<number>();
  const [inspectorSidecarContentId, setInspectorSidecarContentId] = useState('');
  const [cellContentDraft, setCellContentDraft] = useState<{
    kind: PokeDiscoverCellContentKind;
    cell: PokeDiscoverCellSelection;
  }>();
  const [placementGhost, setPlacementGhost] = useState<{ anchorId: string; label: string; scalePercent: number }>();
  const [movementPathDraft, setMovementPathDraft] = useState<{
    placementId: string;
    points: PokeDiscoverGeometryPoint[];
  }>();
  const [movementTriggerZoneDraft, setMovementTriggerZoneDraft] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  const [activeMovementSequenceId, setActiveMovementSequenceId] = useState('');
  const [catalogSelection, setCatalogSelection] = useState<{ assetId: string; animation: string }>();
  const [catalogForPlacement, setCatalogForPlacement] = useState(false);
  const [organizationDirty, setOrganizationDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>();
  const [recentFolder, setRecentFolder] = useState<PokeDiscoverRecentFolder>();
  const [sanitationIssueOrder, setSanitationIssueOrder] = useState<string[]>([]);
  const [sanitationRosterStep, setSanitationRosterStep] = useState<'pokemon' | 'npc'>('pokemon');
  const [sanitationUndoCount, setSanitationUndoCount] = useState(0);
  const [pendingSanitationDeletion, setPendingSanitationDeletion] = useState(false);
  const [sanitationCommentText, setSanitationCommentText] = useState('');
  const activeMenu = menu ?? 'map';
  const dirtyFiles = useMemo(
    () => workspace ? getPokeDiscoverWorkspaceDirtyFiles(workspace) : [],
    [workspace],
  );
  const snapshot = workspace?.history.present;
  const selectedRegistration = snapshot?.registrations.find(item => item.sectorId === sectorId);
  const selectedRoom = bundle?.sectors.find(room => room.sector.sectorId === sectorId);
  const selectedTilemap = selectedRegistration && snapshot
    ? snapshot.tilemapsByFileName[selectedRegistration.fileName]
    : undefined;
  const selectedCanTest = Boolean(selectedRoom?.sector.spawnAnchorIds.some(anchorId => {
    const anchors = selectedTilemap?.layers.find(layer => layer.name === 'Anchors');
    const object = (Array.isArray(anchors?.objects) ? anchors.objects : [])
      .find(candidate => candidate.name === anchorId);
    return object && ['PlayerSpawn', 'TransitionAnchor'].includes(String(object.class || object.type || ''));
  }));
  const authoringIssues = useMemo(
    () => snapshot && bundle && workspace?.sourceSchemaVersion === 3
      ? auditPokeDiscoverAuthoringSnapshot(snapshot, {
        pokemonAssetIds: new Set(bundle.pmdManifest.assets.map(asset => asset.assetId)),
        npcAssetIds: new Set(bundle.characterManifest.assets
          .filter(asset => asset.role === 'npc')
          .map(asset => asset.assetId)),
      })
      : [],
    [bundle, snapshot, workspace?.sourceSchemaVersion],
  );
  const currentAuthoringIssue = authoringIssues[0];
  const trackedIssueIndex = currentAuthoringIssue
    ? sanitationIssueOrder.indexOf(currentAuthoringIssue.issueId)
    : -1;
  const currentSanitationNumber = currentAuthoringIssue
    ? trackedIssueIndex >= 0 ? trackedIssueIndex + 1 : sanitationIssueOrder.length + 1
    : 0;
  const sanitationTotal = Math.max(
    sanitationIssueOrder.length,
    authoringIssues.length,
    currentSanitationNumber,
  );
  const currentIssueHasPreferredRepair = Boolean(
    currentAuthoringIssue?.canRepair
    || (currentAuthoringIssue?.kind === 'orphan' && bundle
      && inferPokemonAssetsFromAnchorName(
        currentAuthoringIssue.currentName ?? '',
        bundle.pmdManifest,
      ).length === 1),
  );

  useEffect(() => {
    if (!workspace) return;
    setBundle(current => current ? snapshotBundle(current, workspace) : current);
  }, [workspace?.history.present]);

  useEffect(() => {
    if (workspace?.sourceSchemaVersion !== 3) return;
    setSanitationIssueOrder(current => (
      extendPokeDiscoverSanitationIssueOrder(current, authoringIssues)
    ));
  }, [authoringIssues, workspace?.sourceSchemaVersion]);

  useEffect(() => {
    setSanitationRosterStep('pokemon');
    setPendingSanitationDeletion(false);
    setSanitationCommentText(currentAuthoringIssue
      ? defaultPokeDiscoverMigrationComment({
        layerName: currentAuthoringIssue.layerName,
        className: currentAuthoringIssue.currentClass,
        objectName: currentAuthoringIssue.currentName,
      })
      : '');
  }, [currentAuthoringIssue?.issueId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DIRECT_AUTHORING_GESTURE_STORAGE_KEY, directAuthoringGesture);
    } catch {
      // La preferencia de interacción es opcional.
    }
  }, [directAuthoringGesture]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyFiles.length && !organizationDirty && !movementPathDraft) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirtyFiles.length, movementPathDraft, organizationDirty]);

  useEffect(() => {
    if (!workspace?.directoryHandle) return undefined;
    const check = () => {
      void findPokeDiscoverWorkspaceConflicts(workspace).then(found => {
        if (found.length) {
          setConflicts(found);
          setMessage('Hay archivos modificados fuera del configurador.');
        }
      });
    };
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [workspace]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLocaleLowerCase() === 's') {
        event.preventDefault();
        void saveProject();
      }
      if (event.key.toLocaleLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (event.key.toLocaleLowerCase() === 'y'
        || (event.key.toLocaleLowerCase() === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  const buildBundle = async (opened: PokeDiscoverWorkspace) => {
    const snapshot = opened.history.present;
    const tiledMapsByAssetId = new Map(snapshot.registrations.map(registration => [
      registration.assetId,
      snapshot.tilemapsByFileName[registration.fileName],
    ]));
    return loadAdventureMapBundleFromData({
      adventure: snapshot.adventure,
      baseUrl: projectPublicBaseUrl(),
      tiledMapsByAssetId,
      missionDocument: snapshot.missionDocument,
    });
  };

  const finishOpen = async ({
    files,
    directoryHandle,
    projectName,
    metadata,
  }: {
    files: PokeDiscoverWorkspaceSourceFile[];
    directoryHandle?: PokeDiscoverDirectoryHandle;
    projectName?: string;
    metadata?: PokeDiscoverProjectMetadata;
  }) => {
    setStatus('loading');
    setMessage('Leyendo sectores y preparando el mundo…');
    setMenu(undefined);
    try {
      const opened = await openPokeDiscoverWorkspace({
        files,
        directoryHandle,
        metadata,
        projectName,
      });
      const loadedBundle = await buildBundle(opened);
      const openedSnapshot = opened.history.present;
      const preferredRoom = opened.history.present.adventure.entryPoints?.[0]?.sectorId
        ?? openedSnapshot.registrations.find(item => !item.archived)?.sectorId
        ?? loadedBundle.sectors[0]?.sector.sectorId
        ?? '';
      setWorkspace(opened);
      setSanitationIssueOrder([]);
      setBundle(loadedBundle);
      setRoomId(preferredRoom);
      setView('room');
      setMode('design');
      setStatus('ready');
      setMessage(`${openedSnapshot.registrations.filter(item => !item.archived).length} sectores abiertos${opened.pendingLayout ? ' · distribución provisional' : ''}.`);
      setRecentFolder(await rememberPokeDiscoverRecentFolder({
        directoryHandle,
        files,
        projectName: opened.projectName,
      }));
    } catch (cause) {
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : 'No se pudo abrir el proyecto.');
    }
  };

  const beginOpen = async (
    files: PokeDiscoverWorkspaceSourceFile[],
    directoryHandle?: PokeDiscoverDirectoryHandle,
    projectName?: string,
    discardPending = false,
  ) => {
    if (!discardPending && (dirtyFiles.length || organizationDirty)) {
      setPendingNavigation({
        message: 'Abrir otra carpeta descartará los cambios actuales.',
        action: () => beginOpen(files, directoryHandle, projectName, true),
      });
      return;
    }
    try {
      const inspection = inspectPokeDiscoverWorkspaceFiles(files);
      if (!inspection.sidecars.length) {
        pendingCreationRef.current = { files, directoryHandle, projectName };
        const suggested = projectName || 'Nueva aventura';
        setCreationMetadata({
          title: suggested,
          mapId: `map:${suggested.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        });
        return;
      }
      await finishOpen({ files, directoryHandle, projectName });
    } catch (cause) {
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : 'No se pudo revisar la carpeta.');
    }
  };

  const chooseFolder = async () => {
    setMenu(undefined);
    const picker = (window as typeof window & {
      showDirectoryPicker?: PokeDiscoverDirectoryPicker;
    }).showDirectoryPicker;
    if (!picker) {
      folderInputRef.current?.click();
      return;
    }
    try {
      const directoryHandle = await picker.call(window, {
        id: 'pokediscover-project',
        mode: 'readwrite',
      });
      setStatus('loading');
      setMessage('Descubriendo aventuras, sectores y misiones…');
      const root = await discoverPokeDiscoverProjectRoot(directoryHandle);
      setProjectRoot(root);
      const requestedMapId = new URL(window.location.href).searchParams.get('map');
      const preferred = root.projects.find(project => (
        project.mapId === requestedMapId
      )) ?? root.projects.find(project => (
        project.mapId === workspace?.history.present.adventure.mapId
      )) ?? root.projects[0];
      await beginOpen(
        preferred.files,
        preferred.directoryHandle,
        preferred.projectName,
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : 'No se pudo acceder a la carpeta.');
    }
  };

  const openRootProject = (project: PokeDiscoverRootProject) => {
    if (project.mapId === snapshot?.adventure.mapId) return;
    void beginOpen(
      project.files,
      project.directoryHandle,
      project.projectName,
    );
  };

  const reopenRecentFolder = async (
    recent: PokeDiscoverRecentFolder,
    requestPermission: boolean,
  ) => {
    try {
      let permission: PermissionState = recent.directoryHandle
        ? await recent.directoryHandle.queryPermission?.({ mode: 'readwrite' }) ?? 'granted'
        : 'denied';
      if (recent.directoryHandle && permission === 'prompt' && requestPermission) {
        permission = await recent.directoryHandle.requestPermission?.({ mode: 'readwrite' }) ?? 'denied';
      }
      if (permission !== 'granted' && !recent.files.length) {
        setStatus('idle');
        setMessage(`Pulsa «Reabrir ${recent.projectName}» para conceder acceso de nuevo.`);
        return;
      }
      setStatus('loading');
      setMessage(`Reabriendo ${recent.projectName}…`);
      const useDirectory = permission === 'granted' && recent.directoryHandle;
      const files = useDirectory
        ? await readPokeDiscoverDirectory(useDirectory)
        : recent.files.map(file => ({ file }));
      const adventureCount = files.filter(source => (
        source.file.name.toLocaleLowerCase().endsWith('.adventure.json')
      )).length;
      if (adventureCount > 1) {
        const root = useDirectory
          ? await discoverPokeDiscoverProjectRoot(useDirectory)
          : await discoverPokeDiscoverProjectFiles(files);
        setProjectRoot(root);
        const requestedMapId = new URL(window.location.href).searchParams.get('map');
        const preferred = root.projects.find(project => project.mapId === requestedMapId)
          ?? root.projects[0];
        await beginOpen(preferred.files, preferred.directoryHandle, preferred.projectName);
        return;
      }
      await beginOpen(files, useDirectory || undefined, recent.projectName);
      if (!useDirectory && recent.directoryHandle) {
        setRecentFolder(await rememberPokeDiscoverRecentFolder({
          directoryHandle: recent.directoryHandle,
          files,
          projectName: recent.projectName,
        }));
      }
    } catch (cause) {
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : 'No se pudo reabrir la carpeta reciente.');
    }
  };

  useEffect(() => {
    if (recentFolderRestoreStartedRef.current) return;
    recentFolderRestoreStartedRef.current = true;
    let active = true;
    void readPokeDiscoverRecentFolder().then(recent => {
      if (!active || !recent) return;
      setRecentFolder(recent);
      void reopenRecentFolder(recent, false);
    });
    return () => {
      active = false;
    };
  }, []);

  const commitSnapshot = (
    update: (current: PokeDiscoverWorkspaceSnapshot) => PokeDiscoverWorkspaceSnapshot,
    description: string,
  ) => {
    setWorkspace(current => {
      if (!current) return current;
      const next = update(current.history.present);
      return {
        ...current,
        history: commitPokeDiscoverEditorHistory(current.history, next),
      };
    });
    setMessage(description);
  };

  const commitSanitationSnapshot = (
    update: (current: PokeDiscoverWorkspaceSnapshot) => PokeDiscoverWorkspaceSnapshot,
    description: string,
  ) => {
    commitSnapshot(update, description);
    setSanitationUndoCount(current => current + 1);
  };

  const undoLastSanitationChange = () => {
    if (!sanitationUndoCount) return;
    setWorkspace(current => current
      ? { ...current, history: undoPokeDiscoverEditorHistory(current.history) }
      : current);
    setSanitationUndoCount(current => Math.max(0, current - 1));
    setPendingSanitationDeletion(false);
    setMessage('Último cambio del saneamiento deshecho.');
  };

  const validateCandidate = (
    adventure: AdventureMapV3,
    tilemapsByFileName: PokeDiscoverWorkspaceSnapshot['tilemapsByFileName'],
  ) => {
    if (!snapshot || !bundle) return [];
    return validateTiledAdventureBundle({
      adventure,
      tiledMaps: Object.fromEntries(snapshot.registrations.map(registration => [
        registration.assetId,
        tilemapsByFileName[registration.fileName],
      ])),
      pmdManifest: bundle.pmdManifest,
      characterManifest: bundle.characterManifest,
      mediaManifest: bundle.mediaManifest,
      missionDocument: snapshot.missionDocument,
    });
  };

  const updateAdventure = (adventure: AdventureMapV3, description = 'Actualizar contenido') => {
    if (snapshot) {
      const errors = validateCandidate(adventure, snapshot.tilemapsByFileName);
      if (errors.length) {
        setMessage(`Cambio rechazado por maps:validate: ${errors[0]}`);
        return;
      }
    }
    commitSnapshot(current => ({ ...current, adventure }), description);
  };

  const updateMissionDocument = (
    missionDocument: NonNullable<PokeDiscoverWorkspaceSnapshot['missionDocument']>,
    description = 'Actualizar misiones',
  ) => {
    commitSnapshot(current => ({
      ...current,
      missionDocument,
      adventure: {
        ...current.adventure,
        missionIds: missionDocument.missions.map(mission => mission.missionId),
      },
    }), description);
  };

  const beginTitleEdit = () => {
    if (!snapshot) return;
    titleClosingRef.current = false;
    setTitleDraft(snapshot.adventure.title);
    setEditingTitle(true);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.editor-title-input')?.select());
  };

  const finishTitleEdit = () => {
    if (titleClosingRef.current) return;
    const title = titleDraft.trim();
    if (!snapshot || !title) return;
    titleClosingRef.current = true;
    setEditingTitle(false);
    if (title !== snapshot.adventure.title) {
      updateAdventure({ ...snapshot.adventure, title }, 'Renombrar mapa');
    }
  };

  const cancelTitleEdit = () => {
    titleClosingRef.current = true;
    setEditingTitle(false);
  };

  const updateTilemap = (tilemap: PokeDiscoverEditableTiledMap, description: string) => {
    if (!selectedRegistration || !snapshot) return;
    const tilemapsByFileName = {
      ...snapshot.tilemapsByFileName,
      [selectedRegistration.fileName]: tilemap,
    };
    const errors = validateCandidate(snapshot.adventure, tilemapsByFileName);
    if (errors.length) {
      setMessage(`Cambio rechazado por maps:validate: ${errors[0]}`);
      return;
    }
    commitSnapshot(current => ({
      ...current,
      tilemapsByFileName,
    }), description);
  };

  const movePlacement = (placementId: string, point: PokeDiscoverGeometryPoint) => {
    if (!snapshot || !selectedTilemap) return;
    const placement = snapshot.adventure.actorPlacements.find(item => item.placementId === placementId)
      ?? snapshot.adventure.characterPlacements.find(item => item.placementId === placementId);
    if (!placement) return;
    const anchorUsers = [
      ...snapshot.adventure.actorPlacements,
      ...snapshot.adventure.characterPlacements,
    ].filter(candidate => candidate.anchorId === placement.anchorId);
    if (anchorUsers.length > 1) {
      setMessage(`No se puede mover porque la posición todavía está compartida por ${anchorUsers.length} entidades.`);
      return;
    }
    const anchor = selectedTilemap.layers.flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
      .find(object => object.name === placement.anchorId);
    if (!anchor) {
      setMessage('No se encontró la posición de esta entidad.');
      return;
    }
    if ((placement.collision ?? 'solid') === 'solid') {
      const collisionLayer = selectedTilemap.layers.find(layer => layer.name === 'Collision');
      const collisions = (Array.isArray(collisionLayer?.objects) ? collisionLayer.objects : [])
        .flatMap(object => {
          const shape = readTiledCollisionShape(object);
          return shape ? [shape] : [];
        });
      if (collisions.some(collision => rectangleOverlapsCollision({
        x: point.x - 8,
        y: point.y - 16,
        width: 16,
        height: 16,
      }, collision))) {
        setMessage('No se puede colocar una entidad sólida sobre una colisión.');
        return;
      }
    }
    const next = updatePokeDiscoverTiledObject(selectedTilemap, Number(anchor.id), object => ({
      ...object,
      x: point.x - Math.max(0, Number(object.width) || 0) / 2,
      y: point.y - Math.max(0, Number(object.height) || 0) / 2,
    }));
    updateTilemap(next, `Mover ${placementId}`);
  };

  const confirmMovementPath = (draft: PokeDiscoverMovementRouteDraft) => {
    if (!snapshot || !selectedTilemap || !selectedRegistration) return 'No hay un sector seleccionado.';
    try {
      const transaction = createPokeDiscoverMovementRoute(
        snapshot.adventure,
        selectedTilemap,
        selectedRegistration.sectorId,
        draft,
      );
      const nextTilemaps = {
        ...snapshot.tilemapsByFileName,
        [selectedRegistration.fileName]: transaction.tilemap,
      };
      const currentErrors = validateCandidate(snapshot.adventure, snapshot.tilemapsByFileName);
      const candidateErrors = validateCandidate(transaction.adventure, nextTilemaps);
      const introduced = findIntroducedPokeDiscoverValidationErrors(currentErrors, candidateErrors);
      if (introduced.length) return introduced[0];
      commitSnapshot(current => ({
        ...current,
        adventure: transaction.adventure,
        tilemapsByFileName: nextTilemaps,
      }), `Crear ruta para ${draft.placementId}`);
      setMovementPathDraft(undefined);
      setMovementTriggerZoneDraft(undefined);
      setActiveMovementSequenceId(transaction.sequenceId);
      return undefined;
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'No se pudo crear la ruta.';
    }
  };

  const movementPathOrigin = (placementId: string) => {
    if (!snapshot || !selectedTilemap) return undefined;
    if (activeMovementSequenceId) {
      const end = lastPokeDiscoverMovementPoint(
        snapshot.adventure,
        selectedTilemap,
        activeMovementSequenceId,
        placementId,
      );
      if (end) return end;
    }
    const placement = snapshot.adventure.actorPlacements.find(item => item.placementId === placementId)
      ?? snapshot.adventure.characterPlacements.find(item => item.placementId === placementId);
    const anchor = placement
      ? selectedTilemap.layers.flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
        .find(object => object.name === placement.anchorId)
      : undefined;
    return anchor ? {
      x: Number(anchor.x) + Math.max(0, Number(anchor.width) || 0) / 2,
      y: Number(anchor.y) + Math.max(0, Number(anchor.height) || 0) / 2,
    } : undefined;
  };

  const updateWorld = (nextWorld: PokeDiscoverWorkspaceSnapshot['world'], description: string) => {
    commitSnapshot(current => ({ ...current, world: nextWorld }), description);
  };

  const applyWorldOrganization = (
    nextWorld: PokeDiscoverWorkspaceSnapshot['world'],
    description: string,
  ) => {
    commitSnapshot(
      current => applyPokeDiscoverWorldOrganization(current, nextWorld),
      description,
    );
    setView('world');
  };

  const discardMovementDraftForNavigation = () => {
    if (!movementPathDraft) return true;
    if (!window.confirm('La ruta todavía no se ha confirmado. ¿Descartarla y continuar?')) {
      return false;
    }
    setMovementPathDraft(undefined);
    setMovementTriggerZoneDraft(undefined);
    return true;
  };

  const navigateView = (nextView: MainView) => {
    if (nextView !== 'room' && !discardMovementDraftForNavigation()) return false;
    if (view === 'organize' && nextView !== 'organize' && organizationDirty
      && !window.confirm('La organización del mundo aún no se ha aplicado. ¿Descartar el borrador?')) {
      return false;
    }
    if (nextView !== 'organize') setOrganizationDirty(false);
    setView(nextView);
    return true;
  };

  const undo = () => {
    setWorkspace(current => current ? { ...current, history: undoPokeDiscoverEditorHistory(current.history) } : current);
    setMessage('Cambio deshecho.');
    setMenu(undefined);
  };

  const redo = () => {
    setWorkspace(current => current ? { ...current, history: redoPokeDiscoverEditorHistory(current.history) } : current);
    setMessage('Cambio rehecho.');
    setMenu(undefined);
  };

  async function saveProject(
    overwriteConflicts = false,
    exportDirtyOnly = false,
  ): Promise<boolean> {
    if (!workspace) return false;
    if (workspace.sourceSchemaVersion === 2) {
      setMessage('Confirma o cancela la migración V3 antes de guardar.');
      return false;
    }
    setMenu(undefined);
    let writableWorkspace = workspace;
    if (!writableWorkspace.directoryHandle) {
      const picker = (window as typeof window & {
        showDirectoryPicker?: PokeDiscoverDirectoryPicker;
      }).showDirectoryPicker;
      if (picker) {
        try {
          setMessage('Selecciona de nuevo la carpeta del mapa para permitir la escritura.');
          const directoryHandle = await picker.call(window, {
            id: 'pokediscover-project',
            mode: 'readwrite',
          });
          writableWorkspace = await attachPokeDiscoverWorkspaceDirectory(
            writableWorkspace,
            directoryHandle,
          );
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === 'AbortError') {
            setMessage('No se concedió acceso de escritura.');
            return false;
          }
          setStatus('error');
          setMessage(cause instanceof Error
            ? cause.message
            : 'No se pudo obtener acceso de escritura a la carpeta.');
          return false;
        }
      }
    }
    if (!writableWorkspace.directoryHandle) {
      setMessage(exportDirtyOnly
        ? 'El navegador no permite escribir en la carpeta. Se descargarán los archivos modificados.'
        : 'El navegador no permite escribir en carpetas. Se exportará una copia.');
      downloadPokeDiscoverWorkspaceCopy(writableWorkspace, { dirtyOnly: exportDirtyOnly });
      const exported = markPokeDiscoverWorkspaceExported(writableWorkspace, {
        dirtyOnly: exportDirtyOnly,
      });
      setWorkspace(exported);
      setRecentFolder(await rememberPokeDiscoverRecentFolder({
        files: createPokeDiscoverRecentWorkspaceSources(exported),
        projectName: exported.projectName,
      }));
      setStatus('ready');
      setMessage(exportDirtyOnly
        ? 'Guardado como descarga. Este navegador no permite escribir directamente en carpetas.'
        : 'Guardado como copia. Este navegador no permite guardar directamente en carpetas.');
      return true;
    }
    let grantedPermission: PermissionState;
    try {
      grantedPermission = await requestPokeDiscoverDirectoryWritePermission(
        writableWorkspace.directoryHandle,
      );
    } catch {
      grantedPermission = 'denied';
    }
    if (grantedPermission !== 'granted') {
      setMessage('No se concedió acceso de escritura. Se exportará una copia.');
      downloadPokeDiscoverWorkspaceCopy(writableWorkspace, { dirtyOnly: exportDirtyOnly });
      const exported = markPokeDiscoverWorkspaceExported(writableWorkspace, {
        dirtyOnly: exportDirtyOnly,
      });
      setWorkspace(exported);
      setRecentFolder(await rememberPokeDiscoverRecentFolder({
        directoryHandle: exported.directoryHandle,
        files: createPokeDiscoverRecentWorkspaceSources(exported),
        projectName: exported.projectName,
      }));
      return true;
    }
    setStatus('loading');
    setMessage('Guardando mapas, distribución y proyecto…');
    try {
      const saveWorkspace = () => savePokeDiscoverWorkspace(
        writableWorkspace,
        { overwriteConflicts },
      );
      const saved = projectRoot
        ? await withPokeDiscoverMissionManifestTransaction(
          projectRoot,
          writableWorkspace.history.present.missionDocument,
          writableWorkspace.missionFileName,
          saveWorkspace,
        )
        : await saveWorkspace();
      setWorkspace(saved);
      setRecentFolder(await rememberPokeDiscoverRecentFolder({
        directoryHandle: saved.directoryHandle,
        files: createPokeDiscoverRecentWorkspaceSources(saved),
        projectName: saved.projectName,
      }));
      setConflicts([]);
      setStatus('ready');
      const diagnosticCount = bundle ? auditPokeDiscoverEditorProject(bundle).length : 0;
      setMessage(diagnosticCount
        ? `Borrador guardado con ${diagnosticCount} ${diagnosticCount === 1 ? 'aviso' : 'avisos'} para revisar.`
        : 'Proyecto guardado.');
      return true;
    } catch (cause) {
      const conflictFiles = (cause as Error & { conflicts?: string[] }).conflicts;
      if (conflictFiles?.length) {
        setConflicts(conflictFiles);
        setMessage('Se detectaron cambios externos. Elige cómo resolverlos.');
      } else {
        setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar.');
      }
      setStatus('error');
      return false;
    }
  }

  async function migrateLegacyProject() {
    if (!workspace || workspace.sourceSchemaVersion !== 2) return;
    setStatus('loading');
    try {
      const migrated = await migratePokeDiscoverWorkspaceToV3(workspace);
      setWorkspace(migrated.workspace);
      setSanitationUndoCount(0);
      setStatus('ready');
      setMessage(migrated.backupReused
        ? `Migración V3 preparada reutilizando la copia reciente ${migrated.backupFileName}. Completa los repartos antes de guardar.`
        : `Migración V3 preparada. Copia creada: ${migrated.backupFileName}. Completa los repartos antes de guardar.`);
      openUtility('roster');
    } catch (cause) {
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : 'No se pudo crear la copia V2.');
    }
  }

  const reloadProject = async (discardPending = false) => {
    if (!workspace?.directoryHandle) {
      setMessage('Vuelve a abrir la carpeta para recargarla con este navegador.');
      return;
    }
    if (!discardPending && (dirtyFiles.length || organizationDirty)) {
      setPendingNavigation({
        message: 'Recargar reemplazará el proyecto con la versión guardada en disco.',
        action: () => reloadProject(true),
      });
      return;
    }
    const files = await readPokeDiscoverDirectory(workspace.directoryHandle);
    await finishOpen({
      files,
      directoryHandle: workspace.directoryHandle,
      projectName: workspace.projectName,
    });
  };

  const closeProject = (discardPending = false) => {
    setMenu(undefined);
    if (!discardPending && (dirtyFiles.length || organizationDirty)) {
      setPendingNavigation({
        message: 'Cerrar el proyecto descartará los cambios que no se hayan guardado.',
        action: () => closeProject(true),
      });
      return;
    }
    setWorkspace(undefined);
    setSanitationIssueOrder([]);
    setSanitationUndoCount(0);
    setPendingSanitationDeletion(false);
    setBundle(undefined);
    setRoomId('');
    setView('room');
    setStatus('idle');
    setMessage('Proyecto cerrado.');
    setWindows(INITIAL_WINDOWS);
  };

  const saveAndContinue = async (overwriteConflicts = false) => {
    if (!pendingNavigation) return;
    if (organizationDirty) {
      setMessage('Aplica o cancela primero la organización provisional del mundo.');
      return;
    }
    const saved = await saveProject(overwriteConflicts);
    if (!saved) return;
    const action = pendingNavigation.action;
    setPendingNavigation(undefined);
    await action();
  };

  const openUtility = (id: UtilityId) => {
    setWindows(current => ({ ...current, [id]: true }));
    setWindowOrder(current => [...current.filter(item => item !== id), id]);
    setMenu(undefined);
  };

  const focusUtility = (id: UtilityId) => {
    setWindowOrder(current => current.at(-1) === id
      ? current
      : [...current.filter(item => item !== id), id]);
  };

  const deleteGeometry = (object: PokeDiscoverTiledObject) => {
    if (!snapshot) return;
    const references = object.name
      ? findPokeDiscoverGeometryReferences(snapshot.adventure, object.name)
      : [];
    if (references.length) {
      window.alert(`No se puede eliminar porque aún se usa en:\n\n${references.join('\n')}`);
      return;
    }
    updateTilemap(removePokeDiscoverTiledObject(selectedTilemap!, object.id), 'Eliminar geometría');
  };

  const canCreateCellExit = (cell: PokeDiscoverCellSelection) => {
    if (!cell.edge || !snapshot || !selectedRegistration || !selectedTilemap) return false;
    const source = snapshot.world.maps.find(entry => fileBaseName(entry.fileName) === selectedRegistration.fileName);
    if (!source) return false;
    const sourceWidth = selectedTilemap.width * selectedTilemap.tilewidth;
    const sourceHeight = selectedTilemap.height * selectedTilemap.tileheight;
    const localStart = cell.edge === 'left' || cell.edge === 'right' ? cell.start.y : cell.start.x;
    const localLength = cell.edge === 'left' || cell.edge === 'right'
      ? cell.end.y - cell.start.y
      : cell.end.x - cell.start.x;
    const worldStart = (cell.edge === 'left' || cell.edge === 'right' ? source.y : source.x) + localStart;
    return snapshot.world.maps.some(entry => {
      if (entry === source) return false;
      const registration = snapshot.registrations.find(item => item.fileName === fileBaseName(entry.fileName));
      const target = registration ? snapshot.tilemapsByFileName[registration.fileName] : undefined;
      if (!target) return false;
      const targetWidth = target.width * target.tilewidth;
      const targetHeight = target.height * target.tileheight;
      const overlaps = cell.edge === 'left' || cell.edge === 'right'
        ? worldStart < entry.y + targetHeight && worldStart + localLength > entry.y
        : worldStart < entry.x + targetWidth && worldStart + localLength > entry.x;
      if (!overlaps) return false;
      if (cell.edge === 'left') return entry.x + targetWidth === source.x;
      if (cell.edge === 'right') return entry.x === source.x + sourceWidth;
      if (cell.edge === 'top') return entry.y + targetHeight === source.y;
      return entry.y === source.y + sourceHeight;
    });
  };

  const connectEdge = (edge: PokeDiscoverWorldEdge, sourceStart: number, requestedLength: number) => {
    if (!workspace || !snapshot || !selectedRegistration || !selectedTilemap) return;
    const sourceWorld = snapshot.world.maps.find(entry => fileBaseName(entry.fileName) === selectedRegistration.fileName);
    if (!sourceWorld) {
      setMessage('Esta sector aún no está colocada en la distribución del mundo.');
      return;
    }
    const sourceWidth = selectedTilemap.width * selectedTilemap.tilewidth;
    const sourceHeight = selectedTilemap.height * selectedTilemap.tileheight;
    const sourceWorldStart = (edge === 'left' || edge === 'right')
      ? sourceWorld.y + sourceStart
      : sourceWorld.x + sourceStart;
    const neighborEntry = snapshot.world.maps.find(entry => {
      if (entry === sourceWorld) return false;
      const registration = snapshot.registrations.find(item => item.fileName === fileBaseName(entry.fileName));
      const targetMap = registration ? snapshot.tilemapsByFileName[registration.fileName] : undefined;
      if (!targetMap) return false;
      const targetWidth = targetMap.width * targetMap.tilewidth;
      const targetHeight = targetMap.height * targetMap.tileheight;
      if (edge === 'right') return entry.x === sourceWorld.x + sourceWidth
        && sourceWorldStart < entry.y + targetHeight && sourceWorldStart + requestedLength > entry.y;
      if (edge === 'left') return entry.x + targetWidth === sourceWorld.x
        && sourceWorldStart < entry.y + targetHeight && sourceWorldStart + requestedLength > entry.y;
      if (edge === 'bottom') return entry.y === sourceWorld.y + sourceHeight
        && sourceWorldStart < entry.x + targetWidth && sourceWorldStart + requestedLength > entry.x;
      return entry.y + targetHeight === sourceWorld.y
        && sourceWorldStart < entry.x + targetWidth && sourceWorldStart + requestedLength > entry.x;
    });
    const targetRegistration = neighborEntry
      ? snapshot.registrations.find(item => item.fileName === fileBaseName(neighborEntry.fileName))
      : undefined;
    const targetTilemap = targetRegistration
      ? snapshot.tilemapsByFileName[targetRegistration.fileName]
      : undefined;
    if (!neighborEntry || !targetRegistration || !targetTilemap) {
      setMessage('No hay una sector contigua en ese borde. Revisa la vista Organizar mundo.');
      return;
    }
    const manifestIds = {
      pokemonAssetIds: new Set(bundle?.pmdManifest.assets.map(asset => asset.assetId)),
      npcAssetIds: new Set(bundle?.characterManifest.assets
        .filter(asset => asset.role === 'npc')
        .map(asset => asset.assetId)),
    };
    const sourceSector = snapshot.adventure.sectors.find(
      candidate => candidate.sectorId === selectedRegistration.sectorId,
    );
    const targetSector = snapshot.adventure.sectors.find(
      candidate => candidate.sectorId === targetRegistration.sectorId,
    );
    const rosterErrors = [
      ...(sourceSector
        ? validateAdventureSectorRoster(sourceSector, manifestIds)
        : ['Sector de origen inexistente.']),
      ...(targetSector
        ? validateAdventureSectorRoster(targetSector, manifestIds)
        : ['Sector de destino inexistente.']),
    ];
    if (rosterErrors.length) {
      setMessage(`No se puede crear la transición: ${rosterErrors[0]}`);
      openUtility('roster');
      return;
    }
    const sourceAxisOrigin = (edge === 'left' || edge === 'right') ? sourceWorld.y : sourceWorld.x;
    const targetAxisOrigin = (edge === 'left' || edge === 'right') ? neighborEntry.y : neighborEntry.x;
    const targetMaximum = (edge === 'left' || edge === 'right')
      ? targetTilemap.height * targetTilemap.tileheight
      : targetTilemap.width * targetTilemap.tilewidth;
    const sourceMaximum = (edge === 'left' || edge === 'right') ? sourceHeight : sourceWidth;
    const alignedWorldStart = Math.max(sourceWorldStart, sourceAxisOrigin, targetAxisOrigin);
    const alignedWorldEnd = Math.min(
      sourceWorldStart + requestedLength,
      sourceAxisOrigin + sourceMaximum,
      targetAxisOrigin + targetMaximum,
    );
    if (alignedWorldEnd - alignedWorldStart < 16) {
      setMessage('La salida necesita al menos una casilla compartida con la sector vecina.');
      return;
    }
    const alignedSourceStart = alignedWorldStart - sourceAxisOrigin;
    const targetStart = alignedWorldStart - targetAxisOrigin;
    const length = alignedWorldEnd - alignedWorldStart;
    const connected = connectPokeDiscoverRoomsBidirectionally({
      adventure: snapshot.adventure,
      source: {
        fileName: selectedRegistration.fileName,
        sectorId: selectedRegistration.sectorId,
        tilemap: selectedTilemap,
      },
      target: {
        fileName: targetRegistration.fileName,
        sectorId: targetRegistration.sectorId,
        tilemap: targetTilemap,
      },
      sourceEdge: edge,
      sourceStart: alignedSourceStart,
      targetStart,
      length,
    });
    const nextTilemaps = {
      ...snapshot.tilemapsByFileName,
      [selectedRegistration.fileName]: connected.sourceTilemap,
      [targetRegistration.fileName]: connected.targetTilemap,
    };
    const validationErrors = validateTiledAdventureBundle({
      adventure: connected.adventure,
      tiledMaps: Object.fromEntries(snapshot.registrations.map(registration => [
        registration.assetId,
        nextTilemaps[registration.fileName],
      ])),
      pmdManifest: bundle?.pmdManifest,
      characterManifest: bundle?.characterManifest,
      mediaManifest: bundle?.mediaManifest,
      missionDocument: snapshot.missionDocument,
    });
    if (validationErrors.length) {
      setMessage(`La transición no supera la validación: ${validationErrors[0]}`);
      return;
    }
    commitSnapshot(current => ({
      ...current,
      adventure: connected.adventure,
      tilemapsByFileName: nextTilemaps,
    }), `Conexión creada con ${displayPokeDiscoverRoomLabel(targetRegistration.fileName)}.`);
  };

  const createAtCell = (
    command: PokeDiscoverCellCommand,
    cell: PokeDiscoverCellSelection,
  ) => {
    if (!selectedTilemap || !selectedRegistration || !snapshot) return;
    if (['pokemon', 'npc', 'interaction', 'secret', 'entry'].includes(command)) {
      const sector = snapshot.adventure.sectors.find(
        candidate => candidate.sectorId === selectedRegistration.sectorId,
      );
      const rosterErrors = sector ? validateAdventureSectorRoster(sector, {
        pokemonAssetIds: new Set(bundle?.pmdManifest.assets.map(asset => asset.assetId)),
        npcAssetIds: new Set(bundle?.characterManifest.assets
          .filter(asset => asset.role === 'npc')
          .map(asset => asset.assetId)),
      }) : [`No existe el sector ${selectedRegistration.sectorId}.`];
      if (rosterErrors.length) {
        setMessage(`No se puede crear contenido: ${rosterErrors[0]}`);
        openUtility('roster');
        return;
      }
      setInspectorPlacementId('');
      setInspectorObjectId(undefined);
      setInspectorSidecarContentId('');
      setCellContentDraft({
        kind: command as PokeDiscoverCellContentKind,
        cell,
      });
      return;
    }
    if (command === 'exit') {
      if (!cell.edge) return;
      connectEdge(
        cell.edge,
        cell.edge === 'left' || cell.edge === 'right' ? cell.start.y : cell.start.x,
        cell.edge === 'left' || cell.edge === 'right'
          ? cell.end.y - cell.start.y
          : cell.end.x - cell.start.x,
      );
      return;
    }
    const result = addPokeDiscoverCollisionRectangle(selectedTilemap, cell.start, cell.end);
    setInspectorObjectId(result.object.id);
    updateTilemap(result.tilemap, 'Crear colisión');
  };

  const confirmCellContent = (value: PokeDiscoverCellWizardValue) => {
    if (!cellContentDraft || !selectedTilemap || !selectedRegistration || !snapshot) return;
    const { cell } = cellContentDraft;
    const common = { x: cell.center.x, y: cell.center.y };
    const request = value.recipeId === 'pokemon-placement' || value.recipeId === 'pokemon-encounter'
      ? {
        ...common,
        recipeId: value.recipeId,
        assetId: value.assetId!,
        animation: value.animation || 'Idle',
      } as const
      : value.recipeId === 'npc-placement'
        ? { ...common, recipeId: value.recipeId, assetId: value.assetId! } as const
        : value.recipeId === 'entry-point'
          ? { ...common, recipeId: value.recipeId, label: value.label } as const
          : {
            ...common,
            recipeId: value.recipeId,
            meaningfulKind: value.meaningfulKind,
            prompt: value.prompt,
            text: value.text,
          } as const;
    let transaction: PokeDiscoverAuthoringTransaction;
    try {
      transaction = applyPokeDiscoverImmediateRecipe({
        adventure: snapshot.adventure,
        tilemap: selectedTilemap,
        sectorId: selectedRegistration.sectorId,
        request,
      });
      const nextTilemaps = {
        ...snapshot.tilemapsByFileName,
        [selectedRegistration.fileName]: transaction.tilemap,
      };
      const tiledMaps = Object.fromEntries(snapshot.registrations.map(registration => [
        registration.assetId,
        nextTilemaps[registration.fileName],
      ]));
      const errors = validateTiledAdventureBundle({
        adventure: transaction.adventure,
        tiledMaps,
        pmdManifest: bundle?.pmdManifest,
        characterManifest: bundle?.characterManifest,
        mediaManifest: bundle?.mediaManifest,
        missionDocument: snapshot.missionDocument,
      });
      if (errors.length) throw new Error(errors[0]);
      commitSnapshot(current => ({
        ...current,
        adventure: transaction.adventure,
        tilemapsByFileName: {
          ...current.tilemapsByFileName,
          [selectedRegistration.fileName]: transaction.tilemap,
        },
      }), `Crear ${value.recipeId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La receta no supera la validación.');
      return;
    }
    setCellContentDraft(undefined);
    setInspectorObjectId(transaction.objectId);
    if (transaction.inspector === 'placement') {
      setActivePlacementId(transaction.primaryId);
      setInspectorPlacementId(transaction.primaryId);
    } else {
      setInspectorSidecarContentId(transaction.primaryId);
    }
  };

  const deletePlacement = () => {
    if (!snapshot || !activePlacementId) return;
    const references = [
      ...snapshot.adventure.ambientSequences.flatMap(sequence => sequence.beats
        .filter(step => step.actions.some(action => action.placementId === activePlacementId))
        .map(() => `Escena de ${sequence.sectorId}`)),
      ...snapshot.adventure.behaviorTriggers
        .filter(trigger => trigger.proximity?.target.kind === 'placement'
          && trigger.proximity.target.placementId === activePlacementId)
        .map(trigger => `Regla ${trigger.actionLabel}`),
      ...(snapshot.adventure.interactions ?? [])
        .filter(interaction => interaction.target.kind === 'placement'
          && interaction.target.placementId === activePlacementId)
        .map(interaction => `Interacción ${interaction.prompt}`),
    ];
    if (references.length) {
      window.alert(`No se puede eliminar porque aún se usa en:\n\n${[...new Set(references)].join('\n')}`);
      return;
    }
    const placement = snapshot.adventure.actorPlacements.find(
      item => item.placementId === activePlacementId,
    ) ?? snapshot.adventure.characterPlacements.find(
      item => item.placementId === activePlacementId,
    );
    if (!placement) return;
    const registration = snapshot.registrations.find(
      item => item.sectorId === placement.sectorId,
    );
    const tilemap = registration ? snapshot.tilemapsByFileName[registration.fileName] : undefined;
    const anchor = tilemap?.layers.flatMap(layer => Array.isArray(layer.objects)
      ? layer.objects as PokeDiscoverTiledObject[]
      : []).find(object => object.name === placement.anchorId);
    if (!registration || !tilemap || !anchor) {
      setMessage('No se encontró el ancla derivada de la colocación.');
      return;
    }
    const nextAdventure = synchronizeAdventureRequiredAssetIds({
      ...snapshot.adventure,
      actorPlacements: snapshot.adventure.actorPlacements.filter(item => item.placementId !== activePlacementId),
      characterPlacements: snapshot.adventure.characterPlacements.filter(item => item.placementId !== activePlacementId),
    });
    const nextTilemaps = {
      ...snapshot.tilemapsByFileName,
      [registration.fileName]: removePokeDiscoverTiledObject(tilemap, anchor.id),
    };
    const errors = validateCandidate(nextAdventure, nextTilemaps);
    if (errors.length) {
      setMessage(`No se puede eliminar: ${errors[0]}`);
      return;
    }
    commitSnapshot(current => ({
      ...current,
      adventure: nextAdventure,
      tilemapsByFileName: nextTilemaps,
    }), 'Eliminar colocación y ancla');
    if (inspectorPlacementId === activePlacementId) setInspectorPlacementId('');
    setActivePlacementId('');
  };

  const applySanitationDeletion = (keepComment: boolean) => {
    if (!currentAuthoringIssue || currentAuthoringIssue.objectId === undefined) return;
    commitSanitationSnapshot(current => {
      const removeStaleSpawnReference = currentAuthoringIssue.kind !== 'duplicate-id'
        && currentAuthoringIssue.layerName === 'Anchors'
        && Boolean(currentAuthoringIssue.currentName);
      const adventureWithoutPlacement = currentAuthoringIssue.removablePlacementId
        ? synchronizeAdventureRequiredAssetIds(removePokeDiscoverPokemonPlacement(
          current.adventure,
          currentAuthoringIssue.removablePlacementId,
        ))
        : current.adventure;
      return {
        ...current,
        adventure: removeStaleSpawnReference
          ? {
            ...adventureWithoutPlacement,
            sectors: adventureWithoutPlacement.sectors.map(sector => ({
              ...sector,
              spawnAnchorIds: sector.sectorId === currentAuthoringIssue.sectorId
                ? sector.spawnAnchorIds.filter(
                  anchorId => anchorId !== currentAuthoringIssue.currentName,
                )
                : sector.spawnAnchorIds,
            })),
          }
          : adventureWithoutPlacement,
        tilemapsByFileName: {
          ...current.tilemapsByFileName,
          [currentAuthoringIssue.fileName]: keepComment
            && currentAuthoringIssue.layerName !== 'Comments'
            ? replacePokeDiscoverTiledObjectWithComment(
              current.tilemapsByFileName[currentAuthoringIssue.fileName],
              currentAuthoringIssue.objectId!,
              sanitationCommentText,
            ).tilemap
            : removePokeDiscoverTiledObject(
              current.tilemapsByFileName[currentAuthoringIssue.fileName],
              currentAuthoringIssue.objectId!,
            ),
        },
      };
    }, keepComment && currentAuthoringIssue.layerName !== 'Comments'
      ? 'Elemento eliminado y comentario guardado'
      : 'Elemento eliminado sin comentario');
    setPendingSanitationDeletion(false);
  };

  const selectedWindowRoom = bundle && selectedRoom ? selectedRoom : undefined;
  const inspectedPlacement = snapshot && inspectorPlacementId
    ? snapshot.adventure.actorPlacements.find(item => (
      item.placementId === inspectorPlacementId && item.sectorId === sectorId
    )) ?? snapshot.adventure.characterPlacements.find(item => (
      item.placementId === inspectorPlacementId && item.sectorId === sectorId
    ))
    : undefined;
  const inspectedObject = inspectorObjectId === undefined || !selectedTilemap
    ? undefined
    : selectedTilemap.layers.flatMap(layer => Array.isArray(layer.objects)
      ? layer.objects as PokeDiscoverTiledObject[]
      : [])
      .find(object => object.id === inspectorObjectId) as PokeDiscoverTiledObject | undefined;
  const eventComment = eventCommentObjectId === undefined || !selectedTilemap
    ? undefined
    : selectedTilemap.layers.flatMap(layer => Array.isArray(layer.objects)
      ? layer.objects as PokeDiscoverTiledObject[]
      : [])
      .find(object => object.id === eventCommentObjectId) as PokeDiscoverTiledObject | undefined;
  const inspectedTransition = snapshot?.adventure.transitions
    .find(candidate => candidate.transitionId === inspectorSidecarContentId);
  const inspectedInteraction = (snapshot?.adventure.interactions ?? [])
    .find(candidate => candidate.interactionId === inspectorSidecarContentId);
  const inspectedContentAnchorId = inspectedTransition?.fromAnchorId
    ?? (inspectedInteraction?.target.kind === 'anchor' ? inspectedInteraction.target.anchorId : undefined);
  const inspectedAnchorId = inspectedPlacement?.anchorId ?? inspectedContentAnchorId;
  const inspectedAnchor = inspectedAnchorId && selectedTilemap
    ? (selectedTilemap.layers.find(layer => layer.name === 'Anchors')?.objects as PokeDiscoverTiledObject[] | undefined)
      ?.find(object => object.name === inspectedAnchorId)
    : undefined;
  const showInspector = Boolean(
    view === 'room' && selectedWindowRoom
      && (inspectedPlacement || inspectedObject || inspectedTransition || inspectedInteraction || cellContentDraft),
  );
  const pmdManifest = bundle?.pmdManifest as PmdAnimationManifestV1 | undefined;

  return (
    <main className="editor-desktop">
      <div className="editor-desktop-required" role="alert">
        <strong>Configurador de escritorio</strong>
        <p>Esta herramienta necesita una pantalla de al menos 1280×720. Los mapas no se modificarán.</p>
      </div>
      <div className="editor-desktop-app">
        <header className="editor-appbar">
          <a
            className="editor-brand"
            href="/"
            title="Volver a PokeDiscover"
            onClick={event => {
              event.preventDefault();
              const leave = () => window.location.assign('/');
              if (dirtyFiles.length || organizationDirty) {
                setPendingNavigation({
                  message: 'Volver a PokeDiscover descartará los cambios que no se hayan guardado.',
                  action: leave,
                });
              } else leave();
            }}
          ><span>PD</span><strong>PokeDiscover</strong></a>
          <nav aria-label="Menú principal">
            <DesktopMenu label="Archivo" open={activeMenu === 'file'} onOpen={() => setMenu('file')}>
              <MenuAction onClick={() => void chooseFolder()}>Abrir carpeta…</MenuAction>
              <MenuAction shortcut="Ctrl+S" disabled={!workspace} onClick={() => void saveProject()}>Guardar</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => { if (workspace) downloadPokeDiscoverWorkspaceCopy(workspace); setMenu(undefined); }}>Exportar copia</MenuAction>
              <MenuAction disabled={!workspace} onClick={beginTitleEdit}>Renombrar mapa</MenuAction>
              <hr />
              <MenuAction disabled={!workspace} onClick={() => void reloadProject()}>Recargar</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => closeProject()}>Cerrar</MenuAction>
            </DesktopMenu>
            <DesktopMenu label="Edición" open={activeMenu === 'edit'} onOpen={() => setMenu('edit')}>
              <MenuAction shortcut="Ctrl+Z" disabled={!workspace?.history.past.length} onClick={undo}>Deshacer</MenuAction>
              <MenuAction shortcut="Ctrl+Y" disabled={!workspace?.history.future.length} onClick={redo}>Rehacer</MenuAction>
              <hr />
              <MenuAction disabled={!activePlacementId} onClick={deletePlacement}>Eliminar colocación</MenuAction>
            </DesktopMenu>
            <DesktopMenu label="Mapa" open={activeMenu === 'map'} onOpen={() => setMenu('map')}>
              <MenuAction disabled={!workspace} onClick={() => { if (navigateView('room')) setMode('design'); setMenu(undefined); }}>Sector</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => { navigateView('world'); setMenu(undefined); }}>Vista completa</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => { navigateView('organize'); setMenu(undefined); }}>Organizar mundo</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => { window.dispatchEvent(new Event('pokediscover:recenter')); setMenu(undefined); }}>Recentrar</MenuAction>
              <MenuAction disabled={!workspace || !selectedCanTest} onClick={() => { if (navigateView('room')) setMode('test'); setMenu(undefined); }}>Probar</MenuAction>
              <hr />
              <MenuAction disabled={!workspace} onClick={() => openUtility('entries')}>Entradas del jugador</MenuAction>
              {POKEDISCOVER_CANVAS_TOOLS.map(option => (
                <MenuAction
                  key={option.tool}
                  disabled={!workspace}
                  onClick={() => {
                    if (!navigateView('room')) return;
                    setMode('design');
                    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(
                      'pokediscover:select-map-tool',
                      { detail: { tool: option.tool } },
                    )));
                  }}
                >{option.short}</MenuAction>
              ))}
            </DesktopMenu>
            <DesktopMenu label="Contenido" open={activeMenu === 'content'} onOpen={() => setMenu('content')}>
              <MenuAction disabled={!workspace || !selectedRegistration} onClick={() => openUtility('roster')}>Reparto del sector</MenuAction>
              <hr />
              <MenuAction disabled={!workspace} onClick={() => openUtility('placements')}>Colocaciones</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('encounters')}>Encuentros</MenuAction>
              <MenuAction disabled={!workspace || !selectedRegistration} onClick={() => openUtility('terrain')}>Terreno y lugares</MenuAction>
              <MenuAction disabled={!workspace || !selectedRegistration} onClick={() => openUtility('events')}>Eventos y peligros</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('scenes')}>Escenas</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => {
                const url = resolvePokeDiscoverToolUrl('story');
                if ((dirtyFiles.length || organizationDirty) && !window.confirm('Hay cambios del mapa sin guardar. ¿Descartarlos y abrir Historia?')) return;
                window.location.assign(url);
              }}>Abrir gestor de historia</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('narrative')}>Investigación</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('rules')}>Reglas</MenuAction>
            </DesktopMenu>
            <DesktopMenu label="Herramientas" open={activeMenu === 'tools'} onOpen={() => setMenu('tools')}>
              <MenuAction disabled={!workspace} onClick={() => openUtility('media')}>Importar recursos</MenuAction>
              <MenuAction onClick={() => openUtility('catalog')}>Catálogo</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('simulation')}>Simulación</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('coverage')}>Cobertura</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('review')}>Revisión</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('advanced')}>Datos avanzados</MenuAction>
              <hr />
              <MenuAction
                pressed={directAuthoringGesture === 'direct'}
                onClick={() => {
                  setDirectAuthoringGesture('direct');
                  setMenu(undefined);
                }}
              >Añadir con clic o arrastre</MenuAction>
              <MenuAction
                pressed={directAuthoringGesture === 'shift'}
                onClick={() => {
                  setDirectAuthoringGesture('shift');
                  setMenu(undefined);
                }}
              >Añadir manteniendo Shift</MenuAction>
            </DesktopMenu>
            <DesktopMenu label="Ventana" open={activeMenu === 'window'} onOpen={() => setMenu('window')}>
              <MenuAction onClick={() => {
                setWindows(current => Object.fromEntries(Object.keys(current).map(key => [key, true])) as Record<UtilityId, boolean>);
                window.dispatchEvent(new CustomEvent('pokediscover:window-action', { detail: { action: 'recover' } }));
                setMenu(undefined);
              }}>Recuperar utilidades</MenuAction>
              <MenuAction onClick={() => {
                window.dispatchEvent(new CustomEvent('pokediscover:window-action', { detail: { action: 'minimize' } }));
                setMenu(undefined);
              }}>Minimizar utilidades</MenuAction>
              <MenuAction onClick={() => { setWindows(INITIAL_WINDOWS); setMenu(undefined); }}>Cerrar utilidades</MenuAction>
              <MenuAction onClick={() => { window.dispatchEvent(new Event('pokediscover:restore-layout')); setMenu(undefined); }}>Restaurar disposición</MenuAction>
            </DesktopMenu>
          </nav>
          <div className="editor-appbar__document">
            <span className={dirtyFiles.length ? 'is-dirty' : ''} aria-label={dirtyFiles.length ? 'Cambios pendientes' : 'Todo guardado'} />
            {editingTitle ? <input
              className="editor-title-input"
              value={titleDraft}
              aria-label="Nombre del mapa"
              onChange={event => setTitleDraft(event.target.value)}
              onBlur={finishTitleEdit}
              onKeyDown={event => {
                if (event.key === 'Enter') finishTitleEdit();
                if (event.key === 'Escape') cancelTitleEdit();
              }}
            /> : <button type="button" disabled={!workspace} onClick={beginTitleEdit}>
              {workspace?.history.present.adventure.title ?? 'Sin proyecto'}
            </button>}
          </div>
        </header>

        <input
          ref={folderInputRef}
          data-testid="adventure-folder"
          type="file"
          multiple
          hidden
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={event => {
            const files = Array.from(event.target.files ?? []).map(file => ({ file }));
            if (files.length) {
              const sidecarPaths = files
                .filter(source => source.file.name.toLocaleLowerCase().endsWith('.adventure.json'))
                .map(source => source.file.webkitRelativePath.replaceAll('\\', '/'));
              const looksLikeProjectRoot = sidecarPaths.length > 1
                || sidecarPaths.some(path => path.split('/').length > 3);
              if (looksLikeProjectRoot) {
                void discoverPokeDiscoverProjectFiles(files).then(root => {
                  setProjectRoot(root);
                  const preferred = root.projects[0];
                  return beginOpen(
                    preferred.files,
                    preferred.directoryHandle,
                    preferred.projectName,
                  );
                }).catch(cause => {
                  setStatus('error');
                  setMessage(cause instanceof Error
                    ? cause.message
                    : 'No se pudo descubrir la raíz del proyecto.');
                });
              } else {
                void beginOpen(
                  files,
                  undefined,
                  files[0].file.webkitRelativePath.split('/')[0],
                );
              }
            }
            event.currentTarget.value = '';
          }}
        />

        <div className="editor-app-workspace">
          <aside className="editor-room-explorer" aria-label="Explorador de sectores">
            {projectRoot ? <>
              <header><strong>Aventuras</strong><span>{projectRoot.projects.length}</span></header>
              <div className="editor-room-explorer__list editor-project-explorer__maps">
                {projectRoot.projects.map(project => (
                  <button
                    key={project.mapId}
                    type="button"
                    aria-pressed={project.mapId === snapshot?.adventure.mapId}
                    onClick={() => openRootProject(project)}
                  >
                    <span className="is-ready" aria-hidden="true" />
                    <strong>{project.title}</strong>
                    <small>{project.sectors.length} sectores · {project.missions.length} misiones</small>
                  </button>
                ))}
              </div>
            </> : null}
            <header
              role={workspace ? 'button' : undefined}
              tabIndex={workspace ? 0 : undefined}
              onClick={() => { if (workspace) navigateView('organize'); }}
              onKeyDown={event => {
                if (workspace && (event.key === 'Enter' || event.key === ' ')) navigateView('organize');
              }}
            ><strong>Sectores</strong><span>{snapshot ? `${snapshot.registrations.filter(item => !item.archived).length}/${snapshot.world.maps.length}` : 0}</span></header>
            <div className="editor-room-explorer__list">
              {snapshot?.registrations.filter(registration => !registration.archived).map(registration => {
                const room = snapshot?.adventure.sectors.find(item => item.sectorId === registration.sectorId);
                const hasSpawn = Boolean(room?.spawnAnchorIds.length);
                return (
                  <button
                    key={registration.sectorId}
                    type="button"
                    aria-pressed={sectorId === registration.sectorId && view === 'room'}
                    onClick={() => {
                      if (registration.sectorId !== sectorId && !discardMovementDraftForNavigation()) return;
                      setRoomId(registration.sectorId);
                      if (!navigateView('room')) return;
                      setMode('design');
                    }}
                  >
                    <span className={hasSpawn ? 'is-ready' : 'is-draft'} aria-hidden="true" />
                    <strong>{displayPokeDiscoverRoomLabel(registration.fileName)}</strong>
                    <small>{hasSpawn ? 'Lista para probar' : 'Disponible para diseñar'}</small>
                    {registration.created ? <em>Nueva</em> : null}
                  </button>
                );
              })}
            </div>
            {snapshot?.missionDocument?.missions.length ? <>
              <header><strong>Misiones</strong><span>{snapshot.missionDocument.missions.length}</span></header>
              <div className="editor-room-explorer__list editor-project-explorer__missions">
                {snapshot.missionDocument.missions.map(mission => (
                  <button
                    key={mission.missionId}
                    type="button"
                    onClick={() => {
                      const url = new URL(resolvePokeDiscoverToolUrl('story'));
                      url.searchParams.set('mission', mission.missionId);
                      if ((dirtyFiles.length || organizationDirty) && !window.confirm('Hay cambios del mapa sin guardar. ¿Descartarlos y abrir Historia?')) return;
                      window.location.assign(url.href);
                    }}
                  >
                    <span className="is-ready" aria-hidden="true" />
                    <strong>{mission.title}</strong>
                    <small>{mission.objectives.length} objetivos</small>
                  </button>
                ))}
              </div>
            </> : null}
            <footer>
              <div className="editor-view-modes" role="group" aria-label="Modo de visualización">
                <button type="button" disabled={!workspace} aria-pressed={view === 'room' && mode === 'design'} onClick={() => { if (navigateView('room')) setMode('design'); }}>Diseñar</button>
                <button type="button" disabled={!workspace || !selectedCanTest} aria-pressed={view === 'room' && mode === 'test'} onClick={() => { if (navigateView('room')) setMode('test'); }}>Probar</button>
                <button type="button" disabled={!workspace} aria-pressed={view === 'world'} onClick={() => navigateView('world')}>Ver completo</button>
              </div>
            </footer>
          </aside>

          <section
            className={`editor-main-stage${showInspector ? ' has-placement-inspector' : ''}`}
            aria-label="Lienzo principal"
          >
            <div className="editor-window-bounds" aria-hidden="true" />
            {status === 'loading' ? <div className="editor-stage-loading"><span /><strong>{message}</strong></div> : null}
            {bundle && workspace && snapshot && view !== 'room' ? (
              <WorldAuthoringCanvas
                bundle={bundle}
                world={snapshot.world}
                registrations={snapshot.registrations}
                organize={view === 'organize'}
                onWorldChange={updateWorld}
                onApplyOrganization={applyWorldOrganization}
                onCancelOrganization={() => navigateView('world')}
                onOrganizeRequest={() => navigateView('organize')}
                onOrganizationDirtyChange={setOrganizationDirty}
                onOpenRoom={nextRoomId => {
                  if (nextRoomId !== sectorId && !discardMovementDraftForNavigation()) return;
                  if (!navigateView('room')) return;
                  setRoomId(nextRoomId);
                  setMode('design');
                }}
              />
            ) : bundle && workspace && selectedTilemap && sectorId ? (
              <MapAuthoringCanvas
                bundle={bundle}
                sectorId={sectorId}
                tilemap={selectedTilemap}
                mode={mode}
                onModeChange={setMode}
                onTilemapChange={updateTilemap}
                onDeleteObject={deleteGeometry}
                onConnectEdge={connectEdge}
                placementGhost={placementGhost}
                selectedObjectId={inspectorObjectId}
                onOpenObject={objectId => {
                  setInspectorPlacementId('');
                  setInspectorSidecarContentId('');
                  setInspectorObjectId(objectId);
                }}
                onOpenPlacement={(placementId, kind) => {
                  if (kind === 'encounter' || kind === 'npc') {
                    setActivePlacementId(placementId);
                    setInspectorPlacementId(placementId);
                    setInspectorSidecarContentId('');
                    const linked = snapshot ? linkedPokeDiscoverMovementSequences(
                      snapshot.adventure,
                      sectorId,
                      placementId,
                    ) : [];
                    setActiveMovementSequenceId(current => (
                      linked.some(sequence => sequence.sequenceId === current)
                        || snapshot?.adventure.ambientSequences.some(sequence => (
                          sequence.sequenceId === current && sequence.sectorId === sectorId
                        ))
                        || snapshot?.adventure.mapSequences?.some(sequence => (
                          sequence.sequenceId === current && sequence.sectorId === sectorId
                        ))
                        ? current
                        : linked.at(-1)?.sequenceId ?? ''
                    ));
                  } else {
                    setInspectorPlacementId('');
                    setInspectorSidecarContentId(placementId);
                  }
                  setInspectorObjectId(undefined);
                }}
                onMovePlacement={movePlacement}
                onPathDraft={(placementId, points) => {
                  setMovementPathDraft({ placementId, points });
                  setMovementTriggerZoneDraft(undefined);
                  setActivePlacementId(placementId);
                  setInspectorPlacementId(placementId);
                  setInspectorObjectId(undefined);
                  setInspectorSidecarContentId('');
                }}
                pathDraft={movementPathDraft?.points}
                triggerZoneDraft={movementTriggerZoneDraft}
                getPathOrigin={movementPathOrigin}
                onCellCommand={createAtCell}
                canCreateExit={canCreateCellExit}
                directAuthoringGesture={directAuthoringGesture}
              />
            ) : (
              <div className="editor-start-screen">
                <div aria-hidden="true">⌁</div>
                <h1>Configurador PokeDiscover</h1>
                <p>Abre la carpeta de un mapa. El proyecto se cargará en cuanto la elijas.</p>
                <button type="button" onClick={() => void chooseFolder()}>Abrir carpeta</button>
                {recentFolder ? <button
                  type="button"
                  className="is-secondary"
                  onClick={() => void reopenRecentFolder(recentFolder, true)}
                >Reabrir {recentFolder.projectName}</button> : null}
                {status === 'error' ? <p role="alert">{message}</p> : null}
              </div>
            )}
            {showInspector && selectedWindowRoom && bundle && selectedTilemap ? <aside
              className="editor-placement-inspector"
              aria-label="Inspector de propiedades"
            >
              {inspectedPlacement ? <PlacementPropertiesEditor
                bundle={bundle}
                room={selectedWindowRoom}
                placementId={inspectorPlacementId}
                compact
                onClose={() => setInspectorPlacementId('')}
                onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar colocación')}
              /> : null}
              {inspectedPlacement ? <MovementAndEventsEditor
                bundle={bundle}
                room={selectedWindowRoom}
                placementId={inspectedPlacement.placementId}
                pathDraft={movementPathDraft?.placementId === inspectedPlacement.placementId
                  ? movementPathDraft.points
                  : undefined}
                triggerZone={movementTriggerZoneDraft}
                activeSequenceId={activeMovementSequenceId}
                onActiveSequenceChange={setActiveMovementSequenceId}
                onCancelDraft={() => {
                  setMovementPathDraft(undefined);
                  setMovementTriggerZoneDraft(undefined);
                }}
                onConfirmDraft={confirmMovementPath}
                onTriggerZoneChange={setMovementTriggerZoneDraft}
                onMoveRoute={(sequenceId, pathId, delta) => updateAdventure(
                  movePokeDiscoverMovementPath(snapshot!.adventure, sequenceId, pathId, delta),
                  'Reordenar rutas',
                )}
                onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar evento')}
              /> : null}
              {cellContentDraft ? <CellContentDraftEditor
                bundle={bundle}
                tilemap={selectedTilemap}
                sectorId={sectorId}
                kind={cellContentDraft.kind}
                x={cellContentDraft.cell.center.x}
                y={cellContentDraft.cell.center.y}
                onCancel={() => setCellContentDraft(undefined)}
                onConfirm={confirmCellContent}
              /> : null}
              {inspectorSidecarContentId && (inspectedTransition || inspectedInteraction) ? <SidecarContentPropertiesEditor
                adventure={snapshot!.adventure}
                contentId={inspectorSidecarContentId}
                onClose={() => setInspectorSidecarContentId('')}
                onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar contenido')}
              /> : null}
              {inspectedAnchor ? <GeometryPropertiesEditor
                tilemap={selectedTilemap}
                objectId={inspectedAnchor.id}
                nested
                dependencies={findPokeDiscoverGeometryReferences(snapshot!.adventure, inspectedAnchor.name)}
                onTilemapChange={updateTilemap}
                onDelete={deleteGeometry}
              /> : null}
              {inspectedPlacement ? <AmbientBeatEditor
                bundle={bundle}
                room={selectedWindowRoom}
                initialPlacementId={inspectedPlacement.placementId}
                embedded
                onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar guion automático')}
              /> : null}
              {inspectedObject ? <GeometryPropertiesEditor
                tilemap={selectedTilemap}
                objectId={inspectedObject.id}
                dependencies={findPokeDiscoverGeometryReferences(snapshot!.adventure, inspectedObject.name)}
                onTilemapChange={updateTilemap}
                onDelete={deleteGeometry}
                onClose={() => setInspectorObjectId(undefined)}
                onCreateEvent={object => setEventCommentObjectId(object.id)}
              /> : null}
              {eventComment && isPokeDiscoverEditorComment(eventComment) ? <MapEventFromCommentEditor
                bundle={bundle}
                adventure={snapshot!.adventure}
                sectorId={sectorId}
                comment={eventComment}
                onCancel={() => setEventCommentObjectId(undefined)}
                onConfirm={draft => {
                  if (!selectedRegistration || !snapshot) return 'No hay un sector seleccionado.';
                  try {
                    const transaction = createPokeDiscoverMapEventFromComment(
                      snapshot.adventure,
                      selectedTilemap,
                      sectorId,
                      eventComment.id,
                      draft,
                    );
                    const nextSnapshot = {
                      ...snapshot,
                      adventure: transaction.adventure,
                      tilemapsByFileName: {
                        ...snapshot.tilemapsByFileName,
                        [selectedRegistration.fileName]: transaction.tilemap,
                      },
                    };
                    const currentErrors = validateCandidate(
                      snapshot.adventure,
                      snapshot.tilemapsByFileName,
                    );
                    const candidateErrors = validateCandidate(
                      nextSnapshot.adventure,
                      nextSnapshot.tilemapsByFileName,
                    );
                    const introducedErrors = findIntroducedPokeDiscoverValidationErrors(
                      currentErrors,
                      candidateErrors,
                    );
                    if (introducedErrors.length) return introducedErrors[0];
                    commitSnapshot(() => nextSnapshot, `Crear evento espacial ${transaction.triggerId}`);
                    setEventCommentObjectId(undefined);
                    if (draft.removeComment ?? true) setInspectorObjectId(undefined);
                    return undefined;
                  } catch (cause) {
                    return cause instanceof Error ? cause.message : 'No se pudo crear el evento.';
                  }
                }}
              /> : null}
            </aside> : null}
            {workspace && dirtyFiles.length ? <button
              type="button"
              className="editor-canvas-save"
              disabled={status === 'loading'}
              aria-label={`Guardar ${dirtyFiles.length} ${dirtyFiles.length === 1 ? 'archivo pendiente' : 'archivos pendientes'}`}
              title={`Guardar ${dirtyFiles.length} ${dirtyFiles.length === 1 ? 'archivo pendiente' : 'archivos pendientes'}`}
              onClick={() => void saveProject()}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 3h13l3 3v15H4zM7 3v7h9V3M7 21v-7h10v7M9 5h5v3H9z" /></svg>
              <span>{dirtyFiles.length}</span>
            </button> : null}
          </section>
        </div>

        <footer className="editor-statusbar">
          <span className={`editor-status-dot is-${status}`} aria-hidden="true" />
          <span>{message}</span>
          <span>{selectedRegistration ? `Sector ${displayPokeDiscoverRoomLabel(selectedRegistration.fileName)}` : ''}</span>
          <span>{dirtyFiles.length ? `${dirtyFiles.length} archivo${dirtyFiles.length === 1 ? '' : 's'} pendiente${dirtyFiles.length === 1 ? '' : 's'}` : workspace ? 'Guardado' : ''}</span>
          <ToolNavigation current="editor" onNavigate={url => {
            const leave = () => window.location.assign(url);
            if (dirtyFiles.length || organizationDirty) {
              setPendingNavigation({
                message: 'Abrir otra herramienta descartará los cambios que no se hayan guardado.',
                action: leave,
              });
              return false;
            }
            return true;
          }} />
        </footer>

        {workspace && bundle && snapshot ? (Object.keys(UTILITY_TITLES) as UtilityId[]).map((id, index) => (
          <EditorWindow
            key={id}
            id={id}
            title={UTILITY_TITLES[id]}
            open={windows[id]}
            className={id === 'roster' ? 'is-roster' : undefined}
            initialGeometry={{
              x: 300 + (index % 4) * 54,
              y: 92 + (index % 5) * 38,
              width: id === 'roster'
                ? 980
                : id === 'catalog' || id === 'coverage' ? 900 : 760,
              height: id === 'roster'
                ? 650
                : id === 'catalog' || id === 'coverage' ? 620 : 570,
            }}
            zIndex={100 + windowOrder.indexOf(id)}
            onFocus={() => focusUtility(id)}
            onClose={() => setWindows(current => ({ ...current, [id]: false }))}
          >
            {id === 'roster' && selectedRegistration ? (
              <SectorRosterEditor
                adventure={snapshot.adventure}
                bundle={bundle}
                sectorId={selectedRegistration.sectorId}
                onChange={adventure => updateAdventure(adventure, 'Actualizar reparto del sector')}
              />
            ) : null}
            {id === 'placements' && selectedWindowRoom ? (
              <ContentPlacementEditor
                bundle={bundle}
                room={selectedWindowRoom}
                selectedPlacementId={activePlacementId}
                onPlacementSelect={setActivePlacementId}
                onPlacementPreview={setPlacementGhost}
                catalogSelection={catalogSelection}
                onOpenCatalog={() => {
                  setCatalogForPlacement(true);
                  openUtility('catalog');
                }}
                onChooseMapTool={tool => {
                  if (!navigateView('room')) return;
                  setMode('design');
                  requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(
                    'pokediscover:select-map-tool',
                    { detail: { tool } },
                  )));
                }}
                onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar colocaciones')}
              />
            ) : null}
            {id === 'encounters' && selectedWindowRoom ? (
              <EncounterWorldEditor bundle={bundle} room={selectedWindowRoom} onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar encuentros')} />
            ) : null}
            {id === 'scenes' && selectedWindowRoom ? (
              <AmbientBeatEditor bundle={bundle} room={selectedWindowRoom} onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar escena')} />
            ) : null}
            {id === 'entries' ? (
              <EntryPointEditor snapshot={snapshot} registrations={snapshot.registrations} onAdventureChange={updateAdventure} />
            ) : null}
            {id === 'rules' ? (
              <RequirementEditor adventure={snapshot.adventure} onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar reglas')} />
            ) : null}
            {id === 'terrain' && selectedTilemap ? (
              <TerrainAndLocationsEditor
                tilemap={selectedTilemap}
                onChange={updateTilemap}
                onConfigureFall={() => openUtility('events')}
              />
            ) : null}
            {id === 'events' && selectedTilemap && selectedWindowRoom ? (
              <UnifiedEventEditor
                bundle={bundle}
                room={selectedWindowRoom}
                tilemap={selectedTilemap}
                onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar evento o peligro')}
              />
            ) : null}
            {id === 'media' ? (
              <MediaImportEditor
                rootHandle={projectRoot?.directoryHandle}
                mediaManifest={bundle.mediaManifest ?? { schemaVersion: 1, assets: [] }}
                characterManifest={bundle.characterManifest}
                onImported={() => setMessage('Recurso global importado. Recarga el proyecto para usarlo en selectores.')}
              />
            ) : null}
            {id === 'narrative' ? (
              <NarrativeConfigurationEditor adventure={snapshot.adventure} onAdventureChange={adventure => updateAdventure(adventure, 'Actualizar investigación')} />
            ) : null}
            {id === 'catalog' ? <CatalogExplorer
              pmdManifest={pmdManifest}
              pmdError={bundle ? '' : 'Catálogo no disponible.'}
              selectionMode={catalogForPlacement}
              onSelect={selection => {
                setCatalogSelection(selection);
                setCatalogForPlacement(false);
                setWindows(current => ({ ...current, catalog: false, placements: true }));
                focusUtility('placements');
              }}
            /> : null}
            {id === 'simulation' ? <ProgressSimulationEditor adventure={snapshot.adventure} /> : null}
            {id === 'coverage' ? <ResearchCoverageMatrix adventure={snapshot.adventure} /> : null}
            {id === 'review' ? <ProjectDiagnosticsPanel bundle={bundle} /> : null}
            {id === 'advanced' && selectedWindowRoom ? (
              <div className="editor-advanced-window">
                <p>Los identificadores y referencias internas se muestran aquí para no entorpecer el trabajo habitual.</p>
                <TiledReferenceExplorer room={selectedWindowRoom} />
                <details>
                  <summary>Archivos modificados</summary>
                  <ul>{dirtyFiles.map(fileName => <li key={fileName}><code>{fileName}</code></li>)}</ul>
                </details>
              </div>
            ) : null}
          </EditorWindow>
        )) : windows.catalog ? (
          <EditorWindow
            id="catalog"
            title="Catálogo"
            open
            initialGeometry={{ x: 260, y: 88, width: 900, height: 620 }}
            zIndex={100}
            onFocus={() => undefined}
            onClose={() => setWindows(current => ({ ...current, catalog: false }))}
          >
            <CatalogExplorer pmdManifest={pmdManifest} pmdError="Abre un proyecto para cargar las animaciones." />
          </EditorWindow>
        ) : null}

        {workspace?.sourceSchemaVersion === 2 ? (
          <div className="editor-dialog-backdrop" role="presentation">
            <section className="editor-dialog" role="alertdialog" aria-modal="true" aria-labelledby="migration-v3-title">
              <h2 id="migration-v3-title">Migración explícita a Mapas V3</h2>
              <p>Este proyecto usa el contrato V2. La autoría está bloqueada hasta convertir habitaciones en sectores y preparar sus repartos.</p>
              {workspace.legacyBackup?.recent && workspace.legacyBackup.matchesSource ? (
                <p>Ya existe la copia reciente <code>{workspace.legacyBackup.fileName}</code>. Se reutilizará sin crear otra.</p>
              ) : workspace.legacyBackup?.recent ? (
                <p role="alert">Existe una copia reciente con contenido diferente. No se puede migrar hasta revisar <code>{workspace.legacyBackup.fileName}</code>.</p>
              ) : (
                <p>Antes de modificar el proyecto se creará <code>{workspace.sidecarFileName.replace(/\.adventure\.json$/iu, '.adventure.v2.backup.json')}</code> con el documento V2 original.</p>
              )}
              <div>
                <button type="button" onClick={() => closeProject()}>Cerrar sin migrar</button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={status === 'loading' || Boolean(
                    workspace.legacyBackup?.recent && !workspace.legacyBackup.matchesSource,
                  )}
                  onClick={() => void migrateLegacyProject()}
                >
                  {workspace.legacyBackup?.recent && workspace.legacyBackup.matchesSource
                    ? 'Usar copia reciente y migrar a V3'
                    : 'Crear copia y migrar a V3'}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {workspace?.sourceSchemaVersion === 3 && currentAuthoringIssue && snapshot && bundle ? (
          <div className="editor-dialog-backdrop" role="presentation">
            <section className="editor-dialog editor-sanitation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sanitation-title">
              <header className="editor-sanitation-heading">
                <h2 id="sanitation-title">
                  {currentAuthoringIssue.kind === 'roster'
                    ? sanitationRosterStep === 'pokemon'
                      ? 'Reparto Pokémon del sector'
                      : 'Reparto NPC del sector'
                    : 'Saneamiento obligatorio del mapa'}
                </h2>
                <strong aria-label={`Incidencia ${currentSanitationNumber} de ${sanitationTotal}`}>
                  #{currentSanitationNumber} de {sanitationTotal}
                </strong>
              </header>
              <p className="editor-sanitation-message">
                {currentAuthoringIssue.kind === 'roster' && sanitationRosterStep === 'npc'
                  ? 'Revisa los NPC previstos para este sector antes de continuar.'
                  : currentAuthoringIssue.message}
              </p>
              {currentAuthoringIssue.references.length ? <>
                <h3>Dependencias</h3>
                <ul>{currentAuthoringIssue.references.map(reference => <li key={reference}>{reference}</li>)}</ul>
              </> : null}
              {currentAuthoringIssue.kind === 'roster' ? <SectorRosterEditor
                adventure={snapshot.adventure}
                bundle={bundle}
                sectorId={currentAuthoringIssue.sectorId}
                showValidationMessages={false}
                dialogFlow
                onStepChange={setSanitationRosterStep}
                onChange={adventure => commitSanitationSnapshot(
                  current => ({ ...current, adventure }),
                  'Guardar progreso de reparación del reparto',
                )}
              /> : null}
              <SanitationIssueDetails issue={currentAuthoringIssue} onRepair={() => {
                try {
                  commitSanitationSnapshot(
                    current => repairPokeDiscoverAuthoringIssue(current, currentAuthoringIssue),
                    'Reparar convención del mapa',
                  );
                } catch (cause) {
                  setMessage(cause instanceof Error ? cause.message : 'No se pudo reparar la incidencia.');
                }
              }} customRepair={currentAuthoringIssue.kind === 'orphan'
                && currentAuthoringIssue.currentClass === 'ActorAnchor' ? (
                <OrphanPokemonAnchorRepairEditor
                  snapshot={snapshot}
                  bundle={bundle}
                  issue={currentAuthoringIssue}
                  onError={setMessage}
                  onConfirm={(nextSnapshot, placementId) => {
                    const currentErrors = validateCandidate(
                      snapshot.adventure,
                      snapshot.tilemapsByFileName,
                    );
                    const candidateErrors = validateCandidate(
                      nextSnapshot.adventure,
                      nextSnapshot.tilemapsByFileName,
                    );
                    const introducedErrors = findIntroducedPokeDiscoverValidationErrors(
                      currentErrors,
                      candidateErrors,
                    );
                    if (introducedErrors.length) {
                      const message = `No se pudo corregir: ${introducedErrors[0]}`;
                      setMessage(message);
                      return message;
                    }
                    commitSanitationSnapshot(
                      () => nextSnapshot,
                      'Ancla heredada adaptada a una colocación Pokémon',
                    );
                    setActivePlacementId(placementId);
                    setInspectorPlacementId(placementId);
                    setInspectorObjectId(currentAuthoringIssue.objectId);
                    return undefined;
                  }}
                />
              ) : undefined} />
              {currentAuthoringIssue.kind !== 'roster' ? <>
                {currentAuthoringIssue.canDelete && !currentIssueHasPreferredRepair
                  ? <SanitationCommentEditor
                    text={sanitationCommentText}
                    onChange={setSanitationCommentText}
                  />
                  : null}
              </> : null}
              <div className="editor-sanitation-actions">
                {sanitationUndoCount ? <button
                  type="button"
                  disabled={status === 'loading'}
                  onClick={undoLastSanitationChange}
                >
                  Volver atrás
                </button> : null}
                <button
                  type="button"
                  disabled={status === 'loading' || !dirtyFiles.length}
                  onClick={() => void saveProject(false, true)}
                >
                  Guardar progreso parcial
                </button>
                {currentAuthoringIssue.canDelete ? <>
                  {currentIssueHasPreferredRepair ? <button
                    type="button"
                    disabled={status === 'loading'}
                    onClick={() => setPendingSanitationDeletion(true)}
                  >
                    Eliminar
                  </button> : <>
                    <button
                      type="button"
                      className="is-primary"
                      disabled={status === 'loading' || !sanitationCommentText.trim()}
                      onClick={() => applySanitationDeletion(true)}
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      disabled={status === 'loading'}
                      onClick={() => applySanitationDeletion(false)}
                    >
                      Eliminar sin comentario
                    </button>
                  </>}
                </> : null}
              </div>
              <footer className="editor-sanitation-footer">
                <span>{currentAuthoringIssue.fileName}</span>
                <code>{currentAuthoringIssue.sectorId}</code>
              </footer>
            </section>
          </div>
        ) : null}

        {pendingSanitationDeletion && currentAuthoringIssue?.canDelete ? (
          <div className="editor-dialog-backdrop is-confirmation" role="presentation">
            <section
              className="editor-dialog editor-sanitation-delete-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="sanitation-delete-title"
            >
              <h2 id="sanitation-delete-title">Eliminar elemento</h2>
              <SanitationCommentEditor
                text={sanitationCommentText}
                onChange={setSanitationCommentText}
              />
              <div className="editor-sanitation-actions">
                <button
                  type="button"
                  disabled={status === 'loading'}
                  onClick={() => setPendingSanitationDeletion(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={status === 'loading' || !sanitationCommentText.trim()}
                  onClick={() => applySanitationDeletion(true)}
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  disabled={status === 'loading'}
                  onClick={() => applySanitationDeletion(false)}
                >
                  Eliminar sin comentario
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {creationMetadata ? (
          <div className="editor-dialog-backdrop" role="presentation">
            <form
              className="editor-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-project-title"
              onSubmit={event => {
                event.preventDefault();
                const pending = pendingCreationRef.current;
                if (!pending || !creationMetadata.title.trim() || !creationMetadata.mapId.trim()) return;
                setCreationMetadata(undefined);
                void finishOpen({ ...pending, metadata: creationMetadata });
              }}
            >
              <h2 id="create-project-title">Crear proyecto del mapa</h2>
              <p>La carpeta contiene TMJ pero aún no tiene un proyecto. Se crearán las referencias necesarias sin tocar los tiles.</p>
              <label><span>Nombre del mapa</span><input autoFocus value={creationMetadata.title} onChange={event => setCreationMetadata(current => current ? { ...current, title: event.target.value } : current)} /></label>
              <label><span>Identificador</span><input value={creationMetadata.mapId} onChange={event => setCreationMetadata(current => current ? { ...current, mapId: event.target.value } : current)} /></label>
              <div>
                <button type="button" onClick={() => { setCreationMetadata(undefined); pendingCreationRef.current = undefined; }}>Cancelar</button>
                <button type="submit" className="is-primary">Crear y abrir</button>
              </div>
            </form>
          </div>
        ) : null}

        {pendingNavigation ? (
          <div className="editor-dialog-backdrop" role="presentation">
            <section className="editor-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pending-navigation-title">
              <h2 id="pending-navigation-title">Cambios sin guardar</h2>
              <p>{pendingNavigation.message}</p>
              {organizationDirty ? <p>La organización del mundo sigue siendo un borrador. Vuelve al organizador para aplicarla o cancelarla.</p> : null}
              <div>
                <button type="button" onClick={() => setPendingNavigation(undefined)}>Cancelar</button>
                <button type="button" className="is-danger" onClick={() => {
                  const action = pendingNavigation.action;
                  setPendingNavigation(undefined);
                  void action();
                }}>Descartar</button>
                <button type="button" className="is-primary" disabled={organizationDirty || status === 'loading'} onClick={() => void saveAndContinue()}>
                  {workspace?.directoryHandle ? 'Guardar y continuar' : 'Exportar copia y continuar'}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {conflicts.length ? (
          <div className="editor-dialog-backdrop" role="presentation">
            <section className="editor-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
              <h2 id="conflict-title">Archivos modificados fuera del configurador</h2>
              <p>Para evitar perder trabajo, el guardado se ha detenido.</p>
              <ul>{conflicts.map(fileName => <li key={fileName}>{fileName}</li>)}</ul>
              <div>
                <button type="button" onClick={() => { if (workspace) downloadPokeDiscoverWorkspaceCopy(workspace); setConflicts([]); }}>Exportar copia</button>
                <button type="button" onClick={() => { setConflicts([]); void reloadProject(); }}>Recargar</button>
                <button type="button" className="is-danger" onClick={() => {
                  setConflicts([]);
                  if (pendingNavigation) void saveAndContinue(true);
                  else void saveProject(true);
                }}>Sobrescribir</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
