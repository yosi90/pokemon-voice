import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfessorMissionModal } from '../../src/components/ProfessorMissionModal.js';
import { createDefaultCatalogRecord } from '../../src/domain/catalog/pokemonCatalogModel.js';
import {
  getBrowserPokeVoiceSave,
  updateBrowserPokedexRun,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const catalog = [
  createDefaultCatalogRecord({ id: 1, name: 'bulbasaur' }),
  createDefaultCatalogRecord({ id: 4, name: 'charmander' }),
  createDefaultCatalogRecord({ id: 10, name: 'caterpie' }),
  createDefaultCatalogRecord({ id: 152, name: 'chikorita' }),
];

describe('selector visual de acompañante', () => {
  beforeEach(() => {
    localStorage.clear();
    getBrowserPokeVoiceSave();
    updateBrowserPokedexRun(run => ({
      ...run,
      registeredSpeciesIds: [1, 10],
      discoveryOrder: [1, 10],
    }));
  });

  it('oculta no registrados, diferencia inelegibles y permite elegir', async () => {
    const user = userEvent.setup();
    render(<ProfessorMissionModal open missionIds={[]} catalog={catalog} onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Compañero' }));
    expect(screen.getByText('Bulbasaur')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Aún no quiere')).toBeInTheDocument();
    expect(screen.getByText('Caterpie').closest('article')).toHaveClass('companion-card--ineligible');
    expect(screen.queryByText('Charmander')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin registrar')).not.toBeInTheDocument();

    const chooseButtons = screen.getAllByRole('button', { name: 'Elegir' });
    expect(chooseButtons).toHaveLength(2);
    const enabled = chooseButtons.filter(button => !button.hasAttribute('disabled'));
    expect(enabled).toHaveLength(1);
    await user.click(enabled[0]);

    expect(screen.getByText('Compañero actual')).toBeInTheDocument();
    expect(getBrowserPokeVoiceSave().pokedexRun.selectedCompanionFormId)
      .toBe('pokemon-form:1:default');

    await user.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByText('Bulbasaur')).toBeInTheDocument();
    expect(screen.getByText('1 Pokémon quiere acompañarte')).toBeInTheDocument();
  });

  it('abre en la portada con perfil y resumen de actividad', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProfessorMissionModal open missionIds={[]} catalog={catalog} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'PokeDiscover' })).toBeInTheDocument();
    expect(screen.getByText('Preparando el primer encargo')).toBeInTheDocument();
    expect(screen.getByText('1 Pokémon quiere acompañarte')).toBeInTheDocument();
    expect(screen.getByText('Aún no has elegido compañero para tu próxima expedición.')).toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Cerrar PokeDiscover' });
    expect(close).toBeVisible();
    await user.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('genera categorías desde registrados y combina categoría con búsqueda', async () => {
    const user = userEvent.setup();
    render(<ProfessorMissionModal open missionIds={[]} catalog={catalog} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Compañero' }));

    const category = screen.getByLabelText('Categoría');
    expect(category).toHaveTextContent('Todos (2)');
    expect(category).toHaveTextContent('Iniciales (1)');
    expect(category).toHaveTextContent('Comunes (1)');
    expect(category).not.toHaveTextContent('Legendarios');
    expect(screen.getByRole('combobox', { name: 'Filtrar por generación' })).toHaveTextContent('Kanto · Gen. 1 (2)');
    expect(screen.getByRole('combobox', { name: 'Filtrar por generación' })).not.toHaveTextContent('Johto');

    await user.selectOptions(category, 'common');
    expect(screen.getByText('Caterpie')).toBeInTheDocument();
    expect(screen.queryByText('Bulbasaur')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Nombre o número'), 'bulba');
    expect(screen.getByText('No hay candidatos conocidos con ese nombre.')).toBeInTheDocument();
  });

  it('genera generaciones desde registrados y las combina con categoría y búsqueda', async () => {
    updateBrowserPokedexRun(run => ({
      ...run,
      registeredSpeciesIds: [1, 10, 152],
      discoveryOrder: [1, 10, 152],
    }));
    const user = userEvent.setup();
    render(<ProfessorMissionModal open missionIds={[]} catalog={catalog} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Compañero' }));

    const generation = screen.getByRole('combobox', { name: 'Filtrar por generación' });
    expect(generation).toHaveTextContent('Kanto · Gen. 1 (2)');
    expect(generation).toHaveTextContent('Johto · Gen. 2 (1)');

    await user.selectOptions(generation, '2');
    expect(screen.getByText('Chikorita')).toBeInTheDocument();
    expect(screen.queryByText('Bulbasaur')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Categoría'), 'common');
    expect(screen.getByText('No hay candidatos conocidos con ese nombre.')).toBeInTheDocument();
  });
});
