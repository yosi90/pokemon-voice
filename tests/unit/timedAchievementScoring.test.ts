import { beforeEach, describe, expect, it } from 'vitest';
import { ACV, achievementProgress } from '../../scripts/achievements-logic.js';
import { getBrowserPokeVoiceSave, setBrowserActiveModeSession, startNewPokedexRun } from '../../src/store/browserPokeVoiceSaveStore.js';
import { achievementUiStore } from '../../src/store/achievementUiStore.js';

const ACHIEVEMENT_ID = 'delibird-gift-claim';
const MODE_ID = 'timed-collector';
const COMPLETION_ACHIEVEMENT_ID = 'timed-collector-complete';

describe('puntuación de logros del contrarreloj', () => {
  beforeEach(() => {
    ACV.resetAllPersistent();
    achievementUiStore.reset();
  });

  it('puntúa un logro permanente una sola vez dentro del evento', async () => {
    ACV.startRun({ runId: 'run:account' });
    await ACV.unlock(ACHIEVEMENT_ID);
    expect(achievementProgress.hasPermanent(ACHIEVEMENT_ID)).toBe(true);

    achievementUiStore.reset();
    startNewPokedexRun({ runId: 'run:timed', sourceModeId: MODE_ID });
    setBrowserActiveModeSession({
      schemaVersion: 1,
      modeId: MODE_ID,
      runId: 'run:timed',
      startedAt: new Date().toISOString(),
      durationSec: 120,
      satisfiedAchievementIds: [],
    });
    ACV.startRun({ runId: 'run:timed', modeId: MODE_ID, durationSec: 120 });

    await expect(ACV.unlock(ACHIEVEMENT_ID)).resolves.toBe(true);
    await expect(ACV.unlock(ACHIEVEMENT_ID)).resolves.toBe(false);

    expect(ACV.getRunSatisfiedIds()).toEqual([ACHIEVEMENT_ID]);
    expect(ACV.getRunUnlocks()).toEqual([]);
    expect(achievementProgress.getSnapshot().permanentRecords.filter(record => record.id === ACHIEVEMENT_ID)).toHaveLength(1);
    expect(achievementUiStore.getSnapshot().toasts).toHaveLength(1);
    expect(achievementUiStore.getSnapshot().toasts[0].title).toContain('Logro del reto');
    expect(getBrowserPokeVoiceSave().activeModeSession?.satisfiedAchievementIds).toEqual([ACHIEVEMENT_ID]);
  });

  it('recupera la deduplicación del evento después de reiniciar el motor', async () => {
    ACV.startRun({ runId: 'run:account' });
    await ACV.unlock(ACHIEVEMENT_ID);
    achievementUiStore.reset();
    ACV.startRun({
      runId: 'run:timed',
      modeId: MODE_ID,
      durationSec: 120,
      satisfiedIds: [ACHIEVEMENT_ID],
    });

    await expect(ACV.unlock(ACHIEVEMENT_ID)).resolves.toBe(false);
    expect(ACV.getRunSatisfiedIds()).toEqual([ACHIEVEMENT_ID]);
    expect(achievementUiStore.getSnapshot().toasts).toHaveLength(0);
  });

  it('mantiene silencioso un logro permanente fuera de los modos', async () => {
    ACV.startRun({ runId: 'run:first' });
    await ACV.unlock(ACHIEVEMENT_ID);
    achievementUiStore.reset();
    ACV.startRun({ runId: 'run:second' });

    await expect(ACV.unlock(ACHIEVEMENT_ID)).resolves.toBe(false);
    expect(achievementUiStore.getSnapshot().toasts).toHaveLength(0);
    expect(ACV.getRunSatisfiedIds()).toEqual([ACHIEVEMENT_ID]);
  });

  it('registra la primera finalización como logro permanente del modo', async () => {
    startNewPokedexRun({ runId: 'run:complete', sourceModeId: MODE_ID });
    setBrowserActiveModeSession({
      schemaVersion: 1,
      modeId: MODE_ID,
      runId: 'run:complete',
      startedAt: new Date().toISOString(),
      durationSec: 120,
    });
    ACV.startRun({ runId: 'run:complete', modeId: MODE_ID, durationSec: 120 });

    await expect(ACV.unlock(COMPLETION_ACHIEVEMENT_ID)).resolves.toBe(true);

    expect(achievementProgress.getPermanentRecord(COMPLETION_ACHIEVEMENT_ID)).toMatchObject({
      domain: 'mode',
      originRunId: 'run:complete',
      originModeId: MODE_ID,
    });
    expect(getBrowserPokeVoiceSave().activeModeSession?.satisfiedAchievementIds)
      .toContain(COMPLETION_ACHIEVEMENT_ID);
  });

  it('atribuye un logro manual al modo sin sustituir la run de Pokédex', async () => {
    ACV.startRun({ runId: 'run:preserved' });

    await expect(ACV.unlockForMode('whos-that-pokemon-complete', 'whos-that-pokemon')).resolves.toBe(true);

    expect(achievementProgress.getPermanentRecord('whos-that-pokemon-complete')).toMatchObject({
      domain: 'mode',
      originRunId: 'run:preserved',
      originModeId: 'whos-that-pokemon',
    });
    expect(achievementProgress.getSnapshot().run.runId).toBe('run:preserved');
  });
});
