import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PokeDiscoverRandomizer } from '../../src/sidewebs/pokediscover-randomizer/PokeDiscoverRandomizer.js';

describe('sideweb Pokémon aleatorio', () => {
  it('sortea un resultado y limpia el anterior al cambiar filtros', async () => {
    const user = userEvent.setup();
    render(<PokeDiscoverRandomizer />);

    expect(screen.getByText('1211 candidatos posibles')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Randomizar' }));
    expect(screen.getByTestId('randomizer-result').querySelector('h2')).not.toBeNull();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Generación' }), '1');
    expect(screen.getByText('Pulsa Randomizar para obtener un Pokémon.')).toBeInTheDocument();
  });

  it('deshabilita el sorteo cuando la combinación no tiene candidatos', async () => {
    const user = userEvent.setup();
    render(<PokeDiscoverRandomizer />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo principal' }), 'normal');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo secundario' }), 'normal');

    expect(screen.getByText('0 candidatos posibles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Randomizar' })).toBeDisabled();
    expect(screen.getByText('No hay Pokémon que cumplan todos esos filtros.')).toBeInTheDocument();
  });
});
