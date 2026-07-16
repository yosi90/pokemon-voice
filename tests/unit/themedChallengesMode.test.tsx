import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemedChallengesMode } from '../../src/components/ThemedChallengesMode.js';
import { THEMED_CHALLENGES } from '../../src/domain/modes/themedChallenges.js';

const baseProps = {
  open: true,
  busy: false,
  foundPokemon: [],
  listening: false,
  speechSupported: true,
  onAnswer: vi.fn(async () => true),
  onClose: vi.fn(),
  onMic: vi.fn(),
  onReturnToSelection: vi.fn(),
  onSelectChallenge: vi.fn(),
};

describe('interfaz de retos temáticos', () => {
  it('presenta las tres categorías y su progreso permanente', () => {
    const session = {
      challenges: [...THEMED_CHALLENGES],
      completedChallengeIds: ['family:bulbasaur'],
      foundIds: [],
      finished: false,
    };
    render(<ThemedChallengesMode {...baseProps} session={session} />);

    expect(document.querySelectorAll('.themed-challenge-card')).toHaveLength(6);
    expect(screen.getByText('Página 1 de 5')).toBeVisible();
    expect(screen.getByText('✓ Completado')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Mmm, suculento/i }));
    expect(baseProps.onSelectChallenge).toHaveBeenCalledWith('family:bulbasaur');

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Página 2 de 5')).toBeVisible();
  });

  it('permite responder al mismo reto por voz o por texto', async () => {
    const onAnswer = vi.fn(async () => true);
    const onMic = vi.fn();
    const activeChallenge = THEMED_CHALLENGES[2];
    render(
      <ThemedChallengesMode
        {...baseProps}
        session={{
          challenges: [...THEMED_CHALLENGES],
          completedChallengeIds: [],
          activeChallenge,
          foundIds: [],
          finished: false,
        }}
        onAnswer={onAnswer}
        onMic={onMic}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Responder al reto por voz' }));
    expect(onMic).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole('textbox', { name: 'Respuesta del reto temático' }), {
      target: { value: 'bulbasaur' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('bulbasaur', { fromSpeech: false }));
  });

  it('reutiliza el examen sin selector ni vuelta a categorías en la variante diaria', () => {
    const activeChallenge = THEMED_CHALLENGES[0];
    render(
      <ThemedChallengesMode
        {...baseProps}
        variant="daily"
        session={{
          challenges: [activeChallenge],
          completedChallengeIds: [],
          activeChallenge,
          foundIds: activeChallenge.targetSpeciesIds.slice(0, 3),
          finished: true,
          dailyStreak: 4,
        }}
        foundPokemon={[
          { id: 1, name: 'bulbasaur' },
          { id: 4, name: 'charmander' },
          { id: 6, name: 'charizard' },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Examen diario' })).toBeVisible();
    expect(screen.getByText('Racha actual: 4. Mañana tendrás un examen nuevo.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Volver a categorías/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
