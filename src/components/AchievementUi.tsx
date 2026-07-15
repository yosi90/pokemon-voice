import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ACHIEVEMENTS } from '../../scripts/achievements-list.js';
import { achievementProgress } from '../store/achievementProgressStore.js';
import {
  achievementUiStore,
  type AchievementToastNotice,
} from '../store/achievementUiStore.js';

const TIER_ICON: Record<string, string> = {
  Pokeball: '⚪',
  Superball: '🔵',
  Ultraball: '🟡',
  MasterBall: '🟣',
};

const TIER_CLASS: Record<string, string> = {
  Pokeball: 'pokeball',
  Superball: 'superball',
  Ultraball: 'ultraball',
  MasterBall: 'masterball',
};

const achievementById = new Map(ACHIEVEMENTS.map(achievement => [achievement.id, achievement]));
const stampSrc = `${import.meta.env.BASE_URL}assets/images/ash-thumbs-up.png`;

function AchievementToast({ toast }: { toast: AchievementToastNotice }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => achievementUiStore.dismissToast(toast.id),
      toast.durationMs,
    );
    return () => window.clearTimeout(timeoutId);
  }, [toast.durationMs, toast.id]);

  return (
    <div
      className={`acv-toast acv-toast--${TIER_CLASS[toast.tier] || 'pokeball'}`}
      style={{ '--toast-duration': `${toast.durationMs}ms` } as React.CSSProperties}
      data-achievement-id={toast.achievementId}
    >
      <span className="ball">{TIER_ICON[toast.tier] || '⚪'}</span>
      <div className="acv-toast__body">
        <div className="acv-toast__eyebrow">Logro desbloqueado</div>
        <b>{toast.title}</b>
        <div>{toast.description}</div>
      </div>
      <button
        className="acv-toast__close"
        type="button"
        aria-label="Descartar logro"
        onClick={() => achievementUiStore.dismissToast(toast.id)}
      >
        ×
      </button>
      <span className="acv-toast__timer" />
    </div>
  );
}

export function AchievementToasts() {
  const { toasts } = useSyncExternalStore(
    achievementUiStore.subscribe,
    achievementUiStore.getSnapshot,
  );

  return (
    <div id="acv-toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map(toast => <AchievementToast key={toast.id} toast={toast} />)}
    </div>
  );
}

export function AchievementsDrawer() {
  const drawerRef = useRef<HTMLElement>(null);
  const { drawerOpen } = useSyncExternalStore(
    achievementUiStore.subscribe,
    achievementUiStore.getSnapshot,
  );
  const { permanentRecords } = useSyncExternalStore(
    achievementProgress.subscribe,
    achievementProgress.getSnapshot,
  );

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (drawerRef.current?.contains(target)) return;
      if (document.getElementById('acv-ach-btn')?.contains(target)) return;
      achievementUiStore.closeDrawer();
    };
    document.addEventListener('click', closeOutside);
    return () => document.removeEventListener('click', closeOutside);
  }, [drawerOpen]);

  const entries = [...permanentRecords].sort((a, b) => a.date - b.date);

  return (
    <aside
      ref={drawerRef}
      id="acv-drawer"
      className="side-drawer side-drawer--right"
      aria-hidden={!drawerOpen}
      aria-label="Panel de logros"
    >
      <header className="drawer-header">
        <h3>Logros</h3>
        <button
          id="acv-drawer-close"
          className="icon-btn"
          type="button"
          aria-label="Cerrar"
          onClick={() => achievementUiStore.closeDrawer()}
        >
          ×
        </button>
      </header>
      <div id="acv-ach-list" className="drawer-content" role="list">
        {entries.length === 0 ? (
          <div className="acv-ach acv-ach--empty">
            <div className="ball">🏆</div>
            <div>
              <div className="title">Aún no hay logros</div>
              <div className="desc">¡Empieza una run y desbloquea alguno!</div>
            </div>
            <div>—</div>
          </div>
        ) : entries.map(entry => {
          const achievement = achievementById.get(entry.id);
          return (
            <div className="acv-ach" data-id={entry.id} role="listitem" key={entry.id}>
              <div className="ball">{TIER_ICON[achievement?.tier || ''] || '⚪'}</div>
              <div>
                <div className="title">{achievement?.title || entry.id}</div>
                <div className="desc">{achievement?.desc || ''}</div>
                <div className="date">{new Date(entry.date).toLocaleString()}</div>
              </div>
              <div className="acv-ach__stamp" aria-label="Logro obtenido">
                <img src={stampSrc} alt="" loading="lazy" />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
