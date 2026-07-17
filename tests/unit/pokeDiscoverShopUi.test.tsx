import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PokeDiscoverShop } from '../../src/components/PokeDiscoverShop.js';
import {
  getBrowserPokeVoiceSave,
  updateBrowserPokeDiscover,
} from '../../src/store/browserPokeVoiceSaveStore.js';

function ShopHarness() {
  const [save, setSave] = useState(getBrowserPokeVoiceSave);
  return <PokeDiscoverShop save={save} onSaveChange={setSave} />;
}

describe('tienda de PokeDiscover', () => {
  beforeEach(() => localStorage.clear());

  it('explica contenido opcional y compra y equipa una herramienta permanente', async () => {
    getBrowserPokeVoiceSave();
    updateBrowserPokeDiscover(state => ({ ...state, discoveryPoints: 500 }));
    render(<ShopHarness />);

    expect(screen.getByText('Pala de campo')).toBeInTheDocument();
    expect(screen.getByText('Cepillo de arqueología')).toBeInTheDocument();
    expect(screen.getByText('Bote plegable')).toBeInTheDocument();
    expect(screen.getByText(/Ninguna compra es necesaria/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '90 PD' }));
    expect(screen.getByRole('button', { name: 'Equipada' })).toBeDisabled();
    expect(getBrowserPokeVoiceSave().pokeDiscover.inventory).toMatchObject({
      toolIds: ['tool:shovel'],
      selectedToolId: 'tool:shovel',
    });
  });
});
