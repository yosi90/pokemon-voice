import { fireEvent, render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokemonGrid } from '../../src/components/PokemonGrid.jsx';
import { usePokeballMotion } from '../../src/hooks/usePokeballMotion.js';

const motionQuery = (query: string) => ({
  matches: query.includes('pointer: fine'),
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

function MotionHarness() {
  const gridRef = useRef<HTMLDivElement>(null);
  usePokeballMotion(gridRef);

  return (
    <div ref={gridRef} className="grid">
      {[1, 2].map(id => (
        <article key={id} className="pokemon-card" data-id={id}>
          <div className="pokemon-ball-card">
            <div className="ball-assembly" />
          </div>
        </article>
      ))}
    </div>
  );
}

describe('movimiento pseudo-3D de las Pokéballs', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(motionQuery));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      setTimeout(() => callback(0), 0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('comparte la misma geometría entre las cuatro variantes actuales', () => {
    const { container } = render(
      <PokemonGrid
        list={[
          { id: 25, name: 'pikachu' },
          { id: 149, name: 'dragonite' },
          { id: 150, name: 'mewtwo' },
          { id: 151, name: 'mew' },
        ]}
        guessed={new Set()}
        lastRevealedId={null}
        focusedCardId={null}
        cardRefs={{ current: new Map<number, HTMLElement>() }}
        onOpenDetails={vi.fn()}
        sleepMode={false}
        imageStyle="3d"
        discoveryConsole={{ guessText: '', onGuessText: vi.fn(), onGuess: vi.fn(), onMic: vi.fn() }}
      />,
    );

    expect([...container.querySelectorAll('.pokemon-card')].map(card => card.getAttribute('data-ball')))
      .toEqual(['poke', 'super', 'ultra', 'master']);
    expect(container.querySelectorAll('.ball-assembly')).toHaveLength(4);
    expect(container.querySelectorAll('.ball-assembly .ball-button')).toHaveLength(4);
  });

  it('limita la rotación, mantiene una sola bola activa y restaura la anterior', async () => {
    const { container } = render(<MotionHarness />);
    const assemblies = [...container.querySelectorAll<HTMLElement>('.ball-assembly')];
    assemblies.forEach(assembly => {
      vi.spyOn(assembly, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100,
        toJSON: () => ({}),
      });
    });

    fireEvent.pointerMove(assemblies[0], { clientX: 180, clientY: -60 });
    await waitFor(() => expect(assemblies[0].style.getPropertyValue('--ball-rotate-y')).toBe('14.00deg'));
    expect(assemblies[0].style.getPropertyValue('--ball-rotate-x')).toBe('10.00deg');
    expect(assemblies[0]).toHaveClass('is-ball-tilting');

    fireEvent.pointerMove(assemblies[1], { clientX: 50, clientY: 50 });
    await waitFor(() => expect(assemblies[1]).toHaveClass('is-ball-tilting'));
    expect(assemblies[0]).not.toHaveClass('is-ball-tilting');
    expect(assemblies[0].style.getPropertyValue('--ball-rotate-y')).toBe('');

    fireEvent.pointerOut(assemblies[1], { relatedTarget: document.body });
    expect(assemblies[1]).not.toHaveClass('is-ball-tilting');
  });

});
