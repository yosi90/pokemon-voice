import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhosThatPokemonMode } from '../../src/components/WhosThatPokemonMode.js';

const session = {
  rounds: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, name: `pokemon-${index + 1}` })),
  roundIndex: 0,
  score: 0,
  textHintsRemaining: 5,
  typeHintsRemaining: 3,
  textHintCount: 0,
  cryUsed: false,
  revealedTypes: [],
  finished: false,
  bestScore: 0,
  isNewRecord: false,
};

describe('interfaz de ¿Quién es ese Pokémon?', () => {
  it('ofrece el mismo envío mediante control de voz y fallback de texto', async () => {
    const onMic = vi.fn();
    const onAnswer = vi.fn(async () => true);
    render(
      <WhosThatPokemonMode
        open
        busy={false}
        currentRound={session.rounds[0]}
        session={session}
        visibleHints={[]}
        listening={false}
        speechSupported
        onAnswer={onAnswer}
        onClose={vi.fn()}
        onCry={vi.fn()}
        onHint={vi.fn()}
        onMic={onMic}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        onTypeHint={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Responder por voz' }));
    expect(onMic).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByRole('textbox', { name: 'Respuesta Pokémon' }), {
      target: { value: 'bulbasaur' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('bulbasaur', { fromSpeech: false }));
  });

  it('presenta los comodines como recursos y oculta el grito tras usarlo', () => {
    const onCry = vi.fn();
    const { rerender } = render(
      <WhosThatPokemonMode
        open
        busy={false}
        currentRound={session.rounds[0]}
        session={session}
        visibleHints={[]}
        listening={false}
        speechSupported
        onAnswer={vi.fn(async () => true)}
        onClose={vi.fn()}
        onCry={onCry}
        onHint={vi.fn()}
        onMic={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        onTypeHint={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Escuchar grito' }));
    expect(onCry).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Pista de texto · 5' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Revelar tipos · 3' })).toBeVisible();

    rerender(
      <WhosThatPokemonMode
        open
        busy={false}
        currentRound={session.rounds[0]}
        session={{ ...session, cryUsed: true, revealedTypes: ['grass', 'poison'], typeHintsRemaining: 2 }}
        visibleHints={[]}
        listening={false}
        speechSupported
        onAnswer={vi.fn(async () => true)}
        onClose={vi.fn()}
        onCry={onCry}
        onHint={vi.fn()}
        onMic={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        onTypeHint={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Escuchar grito' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tipos revelados')).toHaveTextContent('Planta');
    expect(screen.getByLabelText('Tipos revelados')).toHaveTextContent('Veneno');
  });
});
