import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryConsole } from '../../src/components/DiscoveryConsole.jsx';

const defaultProps = {
  generation: 1,
  listening: false,
  voiceStatus: null,
  guessText: '',
  onGuessText: vi.fn(),
  onGuess: vi.fn(event => event.preventDefault()),
  onMic: vi.fn(),
  audioBlocked: false,
  onEnableAudio: vi.fn(),
};

describe('selector rápido de regiones', () => {
  it('abre las nueve regiones y comunica la selección', async () => {
    const user = userEvent.setup();
    const onGenerationChange = vi.fn();
    render(<DiscoveryConsole {...defaultProps} onGenerationChange={onGenerationChange} />);

    const trigger = screen.getByRole('button', { name: 'Kanto' });
    await user.click(trigger);
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(9);

    await user.click(screen.getByRole('menuitemradio', { name: 'Johto, generación 2' }));
    expect(onGenerationChange).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('cierra el menú con Escape o al pulsar fuera', async () => {
    const user = userEvent.setup();
    render(<DiscoveryConsole {...defaultProps} onGenerationChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Kanto' });

    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
