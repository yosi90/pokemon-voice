import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AdventureMapV2, PmdAnimationManifestV1 } from '../../../packages/contracts/src/index.js';
import {
  loadAdventureMapBundleFromData,
  type LoadedAdventureMapBundle,
} from '../../domain/maps/loadAdventureBundle.js';
import {
  addPokeDiscoverAnchor,
  addPokeDiscoverCollisionRectangle,
  addPokeDiscoverOccluder,
  connectPokeDiscoverRoomsBidirectionally,
  findPokeDiscoverGeometryReferences,
  type PokeDiscoverWorldEdge,
} from '../../domain/tools/pokeDiscoverEditorGeometry.js';
import {
  commitPokeDiscoverEditorHistory,
  applyPokeDiscoverWorldOrganization,
  fileBaseName,
  redoPokeDiscoverEditorHistory,
  removePokeDiscoverTiledObject,
  undoPokeDiscoverEditorHistory,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from '../../domain/tools/pokeDiscoverEditorProject.js';
import {
  displayPokeDiscoverRoomLabel,
  downloadPokeDiscoverWorkspaceCopy,
  findPokeDiscoverWorkspaceConflicts,
  getPokeDiscoverWorkspaceDirtyFiles,
  inspectPokeDiscoverWorkspaceFiles,
  openPokeDiscoverWorkspace,
  readPokeDiscoverDirectory,
  savePokeDiscoverWorkspace,
  type PokeDiscoverDirectoryHandle,
  type PokeDiscoverProjectMetadata,
  type PokeDiscoverWorkspace,
  type PokeDiscoverWorkspaceSnapshot,
  type PokeDiscoverWorkspaceSourceFile,
} from '../../domain/tools/pokeDiscoverEditorWorkspace.js';
import { auditPokeDiscoverEditorProject } from '../../domain/tools/pokeDiscoverEditorDiagnostics.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import {
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
import { NarrativeConfigurationEditor } from './NarrativeConfigurationEditor.js';
import { ProgressSimulationEditor } from './ProgressSimulationEditor.js';
import { ProjectDiagnosticsPanel } from './ProjectDiagnosticsPanel.js';
import { RequirementEditor } from './RequirementEditor.js';
import { ResearchCoverageMatrix } from './ResearchCoverageMatrix.js';
import { TiledReferenceExplorer } from './TiledReferenceExplorer.js';
import { SidecarContentPropertiesEditor } from './SidecarContentPropertiesEditor.js';
import { WorldAuthoringCanvas } from './WorldAuthoringCanvas.js';
import {
  CellContentDraftEditor,
  type PokeDiscoverCellContentKind,
} from './CellContentDraftEditor.js';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type MainView = 'room' | 'world' | 'organize';
type PendingNavigation = {
  message: string;
  action: () => void | Promise<void>;
};
type DirectAuthoringGesture = 'direct' | 'shift';
type UtilityId =
  | 'placements'
  | 'encounters'
  | 'scenes'
  | 'entries'
  | 'rules'
  | 'narrative'
  | 'catalog'
  | 'simulation'
  | 'coverage'
  | 'review'
  | 'advanced';

const UTILITY_TITLES: Record<UtilityId, string> = {
  placements: 'Colocaciones',
  encounters: 'Encuentros',
  scenes: 'Escenas y movimiento',
  entries: 'Entradas del jugador',
  rules: 'Reglas',
  narrative: 'Investigación y narrativa',
  catalog: 'Catálogo',
  simulation: 'Simulación',
  coverage: 'Cobertura de investigación',
  review: 'Revisión del proyecto',
  advanced: 'Datos avanzados',
};

const INITIAL_WINDOWS: Record<UtilityId, boolean> = {
  placements: false,
  encounters: false,
  scenes: false,
  entries: false,
  rules: false,
  narrative: false,
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
  const registrationsByRoom = new Map(snapshot.registrations.map(item => [item.roomId, item]));
  const withAdventure = applyEditorAdventure(current, snapshot.adventure);
  return {
    ...withAdventure,
    rooms: withAdventure.rooms.map(room => {
      const registration = registrationsByRoom.get(room.room.roomId);
      const source = registration ? snapshot.tilemapsByFileName[registration.fileName] : undefined;
      return source ? {
        ...room,
        tilemap: {
          ...source,
          // El cargador ya ha resuelto TSX/TSJ e imágenes; las capas editables proceden del documento fuente.
          tilesets: room.tilemap.tilesets,
        },
      } : room;
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
  const [bundle, setBundle] = useState<LoadedAdventureMapBundle>();
  const [roomId, setRoomId] = useState('');
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
  const [inspectorSidecarContentId, setInspectorSidecarContentId] = useState('');
  const [cellContentDraft, setCellContentDraft] = useState<{
    kind: PokeDiscoverCellContentKind;
    cell: PokeDiscoverCellSelection;
  }>();
  const [placementGhost, setPlacementGhost] = useState<{ anchorId: string; label: string; scalePercent: number }>();
  const [catalogSelection, setCatalogSelection] = useState<{ assetId: string; animation: string }>();
  const [catalogForPlacement, setCatalogForPlacement] = useState(false);
  const [organizationDirty, setOrganizationDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>();
  const [recentFolder, setRecentFolder] = useState<PokeDiscoverRecentFolder>();
  const activeMenu = menu ?? 'map';
  const dirtyFiles = useMemo(
    () => workspace ? getPokeDiscoverWorkspaceDirtyFiles(workspace) : [],
    [workspace],
  );
  const snapshot = workspace?.history.present;
  const selectedRegistration = snapshot?.registrations.find(item => item.roomId === roomId);
  const selectedRoom = bundle?.rooms.find(room => room.room.roomId === roomId);
  const selectedTilemap = selectedRegistration && snapshot
    ? snapshot.tilemapsByFileName[selectedRegistration.fileName]
    : undefined;
  const selectedCanTest = Boolean(selectedRoom?.room.spawnAnchorIds.some(anchorId => {
    const anchors = selectedTilemap?.layers.find(layer => layer.name === 'Anchors');
    const object = (Array.isArray(anchors?.objects) ? anchors.objects : [])
      .find(candidate => candidate.name === anchorId);
    return object && ['PlayerSpawn', 'TransitionAnchor'].includes(String(object.class || object.type || ''));
  }));

  useEffect(() => {
    if (!workspace) return;
    setBundle(current => current ? snapshotBundle(current, workspace) : current);
  }, [workspace?.history.present]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DIRECT_AUTHORING_GESTURE_STORAGE_KEY, directAuthoringGesture);
    } catch {
      // La preferencia de interacción es opcional.
    }
  }, [directAuthoringGesture]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyFiles.length && !organizationDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirtyFiles.length, organizationDirty]);

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
    setMessage('Leyendo habitaciones y preparando el mundo…');
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
      const preferredRoom = opened.history.present.adventure.entryPoints?.[0]?.roomId
        ?? openedSnapshot.registrations.find(item => !item.archived)?.roomId
        ?? loadedBundle.rooms[0]?.room.roomId
        ?? '';
      setWorkspace(opened);
      setBundle(loadedBundle);
      setRoomId(preferredRoom);
      setView('room');
      setMode('design');
      setStatus('ready');
      setMessage(`${openedSnapshot.registrations.filter(item => !item.archived).length} habitaciones abiertas${opened.pendingLayout ? ' · distribución provisional' : ''}.`);
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
      showDirectoryPicker?: () => Promise<PokeDiscoverDirectoryHandle>;
    }).showDirectoryPicker;
    if (!picker) {
      folderInputRef.current?.click();
      return;
    }
    try {
      const directoryHandle = await picker.call(window);
      const files = await readPokeDiscoverDirectory(directoryHandle);
      await beginOpen(files, directoryHandle, directoryHandle.name);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : 'No se pudo acceder a la carpeta.');
    }
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

  const updateAdventure = (adventure: AdventureMapV2, description = 'Actualizar contenido') => {
    commitSnapshot(current => ({ ...current, adventure }), description);
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
    if (!selectedRegistration) return;
    commitSnapshot(current => ({
      ...current,
      tilemapsByFileName: {
        ...current.tilemapsByFileName,
        [selectedRegistration.fileName]: tilemap,
      },
    }), description);
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

  const navigateView = (nextView: MainView) => {
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

  async function saveProject(overwriteConflicts = false): Promise<boolean> {
    if (!workspace) return false;
    setMenu(undefined);
    if (!workspace.directoryHandle) {
      setMessage('La carpeta se abrió sin permiso de escritura. Se exportará una copia.');
      downloadPokeDiscoverWorkspaceCopy(workspace);
      return true;
    }
    setStatus('loading');
    setMessage('Guardando mapas, distribución y proyecto…');
    try {
      const saved = await savePokeDiscoverWorkspace(workspace, { overwriteConflicts });
      setWorkspace(saved);
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
      setMessage('Esta habitación aún no está colocada en la distribución del mundo.');
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
      setMessage('No hay una habitación contigua en ese borde. Revisa la vista Organizar mundo.');
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
      setMessage('La salida necesita al menos una casilla compartida con la habitación vecina.');
      return;
    }
    const alignedSourceStart = alignedWorldStart - sourceAxisOrigin;
    const targetStart = alignedWorldStart - targetAxisOrigin;
    const length = alignedWorldEnd - alignedWorldStart;
    const connected = connectPokeDiscoverRoomsBidirectionally({
      adventure: snapshot.adventure,
      source: {
        fileName: selectedRegistration.fileName,
        roomId: selectedRegistration.roomId,
        tilemap: selectedTilemap,
      },
      target: {
        fileName: targetRegistration.fileName,
        roomId: targetRegistration.roomId,
        tilemap: targetTilemap,
      },
      sourceEdge: edge,
      sourceStart: alignedSourceStart,
      targetStart,
      length,
    });
    commitSnapshot(current => ({
      ...current,
      adventure: connected.adventure,
      tilemapsByFileName: {
        ...current.tilemapsByFileName,
        [selectedRegistration.fileName]: connected.sourceTilemap,
        [targetRegistration.fileName]: connected.targetTilemap,
      },
    }), `Conexión creada con ${displayPokeDiscoverRoomLabel(targetRegistration.fileName)}.`);
  };

  const createAtCell = (
    command: PokeDiscoverCellCommand,
    cell: PokeDiscoverCellSelection,
  ) => {
    if (!selectedTilemap || !selectedRegistration || !snapshot) return;
    if (['pokemon', 'npc', 'interaction', 'secret'].includes(command)) {
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
    const anchorKind = command === 'anchor-actor'
      ? 'ActorAnchor'
      : command === 'anchor-encounter'
        ? 'EncounterAnchor'
        : command === 'anchor-interaction'
          ? 'InteractionAnchor'
          : command === 'anchor-secret'
            ? 'SecretAnchor'
            : command === 'entry'
              ? 'PlayerSpawn'
              : undefined;
    const result = anchorKind
      ? addPokeDiscoverAnchor(selectedTilemap, {
        kind: anchorKind,
        label: anchorKind === 'PlayerSpawn' ? 'entrada-jugador' : 'nuevo',
        x: cell.center.x,
        y: cell.center.y,
      })
      : command === 'collision'
        ? addPokeDiscoverCollisionRectangle(selectedTilemap, cell.start, cell.end)
        : addPokeDiscoverOccluder(selectedTilemap, {
          label: 'nuevo',
          groupId: 'occlusion-group:nuevo',
          start: cell.start,
          end: cell.end,
        });
    setInspectorObjectId(result.object.id);
    if (command === 'entry') {
      commitSnapshot(current => ({
        ...current,
        adventure: {
          ...current.adventure,
          rooms: current.adventure.rooms.map(candidate => candidate.roomId === selectedRegistration.roomId
            ? { ...candidate, spawnAnchorIds: [...new Set([...candidate.spawnAnchorIds, result.object.name])] }
            : candidate),
        },
        tilemapsByFileName: {
          ...current.tilemapsByFileName,
          [selectedRegistration.fileName]: result.tilemap,
        },
      }), 'Crear entrada del jugador');
    } else updateTilemap(result.tilemap, `Crear ${command === 'collision' ? 'colisión' : command === 'occlusion' ? 'oclusión' : 'ancla'}`);
  };

  const confirmCellContent = (value: {
    assetId?: string;
    animation?: string;
    prompt?: string;
  }) => {
    if (!cellContentDraft || !selectedTilemap || !selectedRegistration || !snapshot) return;
    const { kind, cell } = cellContentDraft;
    const anchorKind = kind === 'pokemon'
      ? 'EncounterAnchor'
      : kind === 'npc'
        ? 'ActorAnchor'
        : kind === 'secret'
          ? 'SecretAnchor'
          : 'InteractionAnchor';
    const anchor = addPokeDiscoverAnchor(selectedTilemap, {
      kind: anchorKind,
      label: `${kind}-nuevo`,
      x: cell.center.x,
      y: cell.center.y,
    });
    let placementId = '';
    commitSnapshot(current => {
      const adventure = current.adventure;
      if (kind === 'pokemon') {
        placementId = nextStableEditorId('actor:editor', adventure.actorPlacements.map(item => item.placementId));
        return {
          ...current,
          adventure: {
            ...adventure,
            actorPlacements: [...adventure.actorPlacements, {
              schemaVersion: 1,
              placementId,
              roomId: selectedRegistration.roomId,
              anchorId: anchor.object.name,
              assetId: value.assetId!,
              animation: value.animation || 'Idle',
              direction: 'down',
            }],
            requiredAssetIds: adventure.requiredAssetIds.includes(value.assetId!)
              ? adventure.requiredAssetIds
              : [...adventure.requiredAssetIds, value.assetId!],
          },
          tilemapsByFileName: {
            ...current.tilemapsByFileName,
            [selectedRegistration.fileName]: anchor.tilemap,
          },
        };
      }
      if (kind === 'npc') {
        placementId = nextStableEditorId('character:editor', adventure.characterPlacements.map(item => item.placementId));
        return {
          ...current,
          adventure: {
            ...adventure,
            characterPlacements: [...adventure.characterPlacements, {
              schemaVersion: 1,
              placementId,
              roomId: selectedRegistration.roomId,
              anchorId: anchor.object.name,
              assetId: value.assetId!,
              direction: 'down',
            }],
            requiredAssetIds: adventure.requiredAssetIds.includes(value.assetId!)
              ? adventure.requiredAssetIds
              : [...adventure.requiredAssetIds, value.assetId!],
          },
          tilemapsByFileName: {
            ...current.tilemapsByFileName,
            [selectedRegistration.fileName]: anchor.tilemap,
          },
        };
      }
      const dialogueId = nextStableEditorId(`dialogue:${kind}:editor`, (adventure.dialogues ?? []).map(item => item.dialogueId));
      const interactionId = nextStableEditorId(`interaction:${kind}:editor`, (adventure.interactions ?? []).map(item => item.interactionId));
      placementId = interactionId;
      return {
        ...current,
        adventure: {
          ...adventure,
          interactions: [...(adventure.interactions ?? []), {
            schemaVersion: 1,
            interactionId,
            roomId: selectedRegistration.roomId,
            target: { kind: 'anchor', anchorId: anchor.object.name },
            prompt: value.prompt || (kind === 'secret' ? 'Investigar el secreto' : 'Interactuar'),
            dialogueId,
            meaningfulKind: kind === 'secret' ? 'secret' : 'contextTrigger',
            repeatPolicy: 'oncePerVisit',
          }],
          dialogues: [...(adventure.dialogues ?? []), {
            schemaVersion: 1,
            dialogueId,
            initialPageId: `${dialogueId}:page-1`,
            pages: [{
              schemaVersion: 1,
              pageId: `${dialogueId}:page-1`,
              speakerName: 'PokeDiscover',
              text: value.prompt || 'Contenido pendiente de configurar.',
            }],
          }],
        },
        tilemapsByFileName: {
          ...current.tilemapsByFileName,
          [selectedRegistration.fileName]: anchor.tilemap,
        },
      };
    }, `Crear ${kind === 'pokemon' ? 'Pokémon' : kind === 'npc' ? 'personaje' : kind === 'secret' ? 'secreto' : 'interacción'}`);
    setCellContentDraft(undefined);
    if (kind === 'pokemon' || kind === 'npc') {
      setActivePlacementId(placementId);
      setInspectorPlacementId(placementId);
    } else {
      setInspectorSidecarContentId(placementId);
    }
  };

  const duplicatePlacement = () => {
    if (!snapshot || !activePlacementId) return;
    const actor = snapshot.adventure.actorPlacements.find(item => item.placementId === activePlacementId);
    const character = snapshot.adventure.characterPlacements.find(item => item.placementId === activePlacementId);
    if (!actor && !character) return;
    const source = actor ?? character!;
    const used = new Set([
      ...snapshot.adventure.actorPlacements.map(item => item.placementId),
      ...snapshot.adventure.characterPlacements.map(item => item.placementId),
    ]);
    let placementId = `${source.placementId}:copia`;
    for (let suffix = 2; used.has(placementId); suffix += 1) placementId = `${source.placementId}:copia-${suffix}`;
    updateAdventure(actor ? {
      ...snapshot.adventure,
      actorPlacements: [...snapshot.adventure.actorPlacements, { ...actor, placementId }],
    } : {
      ...snapshot.adventure,
      characterPlacements: [...snapshot.adventure.characterPlacements, { ...character!, placementId }],
    }, 'Duplicar colocación');
    setActivePlacementId(placementId);
  };

  const deletePlacement = () => {
    if (!snapshot || !activePlacementId) return;
    const references = [
      ...snapshot.adventure.ambientSequences.flatMap(sequence => sequence.beats
        .filter(step => step.actions.some(action => action.placementId === activePlacementId))
        .map(() => `Escena de ${sequence.roomId}`)),
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
    updateAdventure({
      ...snapshot.adventure,
      actorPlacements: snapshot.adventure.actorPlacements.filter(item => item.placementId !== activePlacementId),
      characterPlacements: snapshot.adventure.characterPlacements.filter(item => item.placementId !== activePlacementId),
    }, 'Eliminar colocación');
    if (inspectorPlacementId === activePlacementId) setInspectorPlacementId('');
    setActivePlacementId('');
  };

  const selectedWindowRoom = bundle && selectedRoom ? selectedRoom : undefined;
  const inspectedPlacement = snapshot && inspectorPlacementId
    ? snapshot.adventure.actorPlacements.find(item => (
      item.placementId === inspectorPlacementId && item.roomId === roomId
    )) ?? snapshot.adventure.characterPlacements.find(item => (
      item.placementId === inspectorPlacementId && item.roomId === roomId
    ))
    : undefined;
  const inspectedObject = inspectorObjectId === undefined || !selectedTilemap
    ? undefined
    : selectedTilemap.layers.flatMap(layer => Array.isArray(layer.objects)
      ? layer.objects as PokeDiscoverTiledObject[]
      : [])
      .find(object => object.id === inspectorObjectId) as PokeDiscoverTiledObject | undefined;
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
              <MenuAction disabled={!activePlacementId} onClick={duplicatePlacement}>Duplicar colocación</MenuAction>
              <MenuAction disabled={!activePlacementId} onClick={deletePlacement}>Eliminar colocación</MenuAction>
            </DesktopMenu>
            <DesktopMenu label="Mapa" open={activeMenu === 'map'} onOpen={() => setMenu('map')}>
              <MenuAction disabled={!workspace} onClick={() => { if (navigateView('room')) setMode('design'); setMenu(undefined); }}>Habitación</MenuAction>
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
              <MenuAction disabled={!workspace} onClick={() => openUtility('placements')}>Colocaciones</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('encounters')}>Encuentros</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('scenes')}>Escenas</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('narrative')}>Investigación</MenuAction>
              <MenuAction disabled={!workspace} onClick={() => openUtility('rules')}>Reglas</MenuAction>
            </DesktopMenu>
            <DesktopMenu label="Herramientas" open={activeMenu === 'tools'} onOpen={() => setMenu('tools')}>
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
            if (files.length) void beginOpen(files, undefined, files[0].file.webkitRelativePath.split('/')[0]);
            event.currentTarget.value = '';
          }}
        />

        <div className="editor-app-workspace">
          <aside className="editor-room-explorer" aria-label="Explorador de habitaciones">
            <header
              role={workspace ? 'button' : undefined}
              tabIndex={workspace ? 0 : undefined}
              onClick={() => { if (workspace) navigateView('organize'); }}
              onKeyDown={event => {
                if (workspace && (event.key === 'Enter' || event.key === ' ')) navigateView('organize');
              }}
            ><strong>Habitaciones</strong><span>{snapshot ? `${snapshot.registrations.filter(item => !item.archived).length}/${snapshot.world.maps.length}` : 0}</span></header>
            <div className="editor-room-explorer__list">
              {snapshot?.registrations.filter(registration => !registration.archived).map(registration => {
                const room = snapshot?.adventure.rooms.find(item => item.roomId === registration.roomId);
                const hasSpawn = Boolean(room?.spawnAnchorIds.length);
                return (
                  <button
                    key={registration.roomId}
                    type="button"
                    aria-pressed={roomId === registration.roomId && view === 'room'}
                    onClick={() => {
                      setRoomId(registration.roomId);
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
                  if (!navigateView('room')) return;
                  setRoomId(nextRoomId);
                  setMode('design');
                }}
              />
            ) : bundle && workspace && selectedTilemap && roomId ? (
              <MapAuthoringCanvas
                bundle={bundle}
                roomId={roomId}
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
                  } else {
                    setInspectorPlacementId('');
                    setInspectorSidecarContentId(placementId);
                  }
                  setInspectorObjectId(undefined);
                }}
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
              {cellContentDraft ? <CellContentDraftEditor
                bundle={bundle}
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
          <span>{selectedRegistration ? `Habitación ${displayPokeDiscoverRoomLabel(selectedRegistration.fileName)}` : ''}</span>
          <span>{dirtyFiles.length ? `${dirtyFiles.length} archivo${dirtyFiles.length === 1 ? '' : 's'} pendiente${dirtyFiles.length === 1 ? '' : 's'}` : workspace ? 'Guardado' : ''}</span>
        </footer>

        {workspace && bundle && snapshot ? (Object.keys(UTILITY_TITLES) as UtilityId[]).map((id, index) => (
          <EditorWindow
            key={id}
            id={id}
            title={UTILITY_TITLES[id]}
            open={windows[id]}
            initialGeometry={{
              x: 300 + (index % 4) * 54,
              y: 92 + (index % 5) * 38,
              width: id === 'catalog' || id === 'coverage' ? 900 : 760,
              height: id === 'catalog' || id === 'coverage' ? 620 : 570,
            }}
            zIndex={100 + windowOrder.indexOf(id)}
            onFocus={() => focusUtility(id)}
            onClose={() => setWindows(current => ({ ...current, [id]: false }))}
          >
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
