import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AchievementsDrawer,
  AchievementToasts,
} from '../../src/components/AchievementUi.js';
import { achievementProgress } from '../../scripts/achievements-logic.js';
import { achievementUiStore } from '../../src/store/achievementUiStore.js';

describe('interfaz React de logros', () => {
  beforeEach(() => {
    achievementProgress.clearAll();
    achievementUiStore.reset();
  });

  it('representa la colección permanente y controla el cajón desde el store', () => {
    achievementProgress.startRun({ runId: 'run-test' });
    achievementProgress.satisfy({
      id: 'classic-start-pikachu',
      date: 100,
      domain: 'pokedex',
    });
    render(<AchievementsDrawer />);

    const drawer = screen.getByLabelText('Panel de logros');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');

    act(() => achievementUiStore.openDrawer());
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Un inicio clásico')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });

  it('muestra y descarta avisos sin crear nodos de forma imperativa', () => {
    render(<AchievementToasts />);

    act(() => {
      achievementUiStore.enqueueToast({
        achievementId: 'first-blood',
        title: 'Primer paso',
        description: 'Descubre tu primer Pokémon.',
      });
    });

    expect(screen.getByText('Primer paso')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar logro' }));
    expect(screen.queryByText('Primer paso')).not.toBeInTheDocument();
  });
});
