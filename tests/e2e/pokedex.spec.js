import { expect, test } from '@playwright/test';
import {
  mockPokemonApi,
  mockPokemonApiUnavailable,
  pokemonCatalogFixture,
} from '../fixtures/pokemonCatalog.js';

test.beforeEach(async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  await expect(page.locator('.pokemon-card')).toHaveCount(pokemonCatalogFixture.results.length);
});

test('permite descubrir por texto y persiste el resultado', async ({ page }) => {
  await page.getByPlaceholder('Escribe un nombre y pulsa Enter.').fill('pikachu');
  await page.getByPlaceholder('Escribe un nombre y pulsa Enter.').press('Enter');

  await expect(page.getByRole('button', { name: 'pikachu, reproducir sonido' })).toBeVisible();
  await expect(page.getByRole('button', { name: /1 descubiertos/ })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('pikachu descubierto (#0025)');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pokevoice-guessed-v1')))
    .toBe('[25]');
});

test('arranca con el catálogo local cuando PokeAPI no está disponible', async ({ page }) => {
  await page.unroute('https://pokeapi.co/api/v2/**');
  await mockPokemonApiUnavailable(page);
  await page.evaluate(() => localStorage.removeItem('pokevoice-pokemon-catalog-v1'));
  await page.reload();

  await expect(page.locator('.pokemon-card')).toHaveCount(1010);
  await expect(page.locator('.load-error')).toHaveCount(0);
  await expect(page.locator('.pokemon-card[data-id="25"]')).toBeVisible();
  await expect(page.locator('.pokemon-card[data-id="1010"]')).toBeAttached();
});

test('muestra feedback inmediato ante un nombre desconocido', async ({ page }) => {
  await page.getByPlaceholder('Escribe un nombre y pulsa Enter.').fill('definitivamente-no-es-un-pokemon');
  await page.getByPlaceholder('Escribe un nombre y pulsa Enter.').press('Enter');

  await expect(page.locator('.toast--bad')).toHaveText('No encontré "definitivamente-no-es-un-pokemon"');
  await expect(page.getByRole('button', { name: /0 descubiertos/ })).toBeVisible();
});

test('mantiene disponible el fallback de texto en ambos viewports', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');

  await expect(input).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adivinar' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('recupera los descubrimientos al recargar', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('eevee');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'eevee, reproducir sonido' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'eevee, reproducir sonido' })).toBeVisible();
  await expect(page.getByRole('button', { name: /1 descubiertos/ })).toBeVisible();
});

test('aplica los filtros de generación a tarjetas y contadores', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir controles' }).click();
  await page.getByRole('button', { name: 'Gen 1' }).click();

  await expect(page.locator('.pokemon-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /2 restantes/ })).toBeVisible();
  await expect(page.locator('.pokemon-card[data-id="152"]')).toBeVisible();
  await expect(page.locator('.pokemon-card[data-id="906"]')).toBeVisible();
});

test('abre modos e inicia el contrarreloj tras confirmación', async ({ page }) => {
  await page.getByRole('button', { name: 'Modos' }).click();
  await expect(page.locator('#modes-drawer')).toHaveAttribute('aria-hidden', 'false');
  page.once('dialog', dialog => dialog.accept());

  await page.getByRole('button', { name: 'Empezar' }).click();

  await expect(page.locator('.timer-chip')).toContainText('2:00');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('__pv_timer__'))).not.toBeNull();
});

test('recupera el contrarreloj y su run al recargar', async ({ page }) => {
  await page.getByRole('button', { name: 'Modos' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Empezar' }).click();
  const runId = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.runId);

  await page.reload();

  await expect(page.locator('.timer-chip')).toContainText(/1:5\d|2:00/);
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return save.activeModeSession?.runId;
  })).toBe(runId);
});

test('cierra al recargar un contrarreloj caducado durante la ausencia', async ({ page }) => {
  await page.getByRole('button', { name: 'Modos' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    const expiredStartedAt = new Date(Date.now() - 121_000).toISOString();
    save.activeModeSession.startedAt = expiredStartedAt;
    save.pokedexRun.startedAt = expiredStartedAt;
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });

  await page.reload();

  await expect(page.getByRole('dialog', { name: 'Fin del contrarreloj' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).activeModeSession ?? null
  ))).toBeNull();
});

test('cierra el contrarreloj con su resumen', async ({ page }) => {
  await page.clock.install();
  await page.getByRole('button', { name: 'Modos' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Empezar' }).click();

  await page.clock.fastForward('02:01');

  await expect(page.getByRole('dialog', { name: 'Fin del contrarreloj' })).toBeVisible();
  await expect(page.locator('#timed-modal')).toContainText('Descubiertos0');
});

test('explica el fallback cuando la voz no está disponible', async ({ page }) => {
  await page.addInitScript(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });
  await page.reload();

  const modal = page.getByRole('dialog', { name: 'Voz no disponible' });
  await expect(modal).toContainText('Puedes seguir descubriendo Pokemon escribiendo nombres');
  await modal.getByRole('button', { name: 'Entendido' }).click();
  await expect(modal).toBeHidden();
});

test('registra y muestra los logros desbloqueados', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('pokevoice-achievements-v1') || '[]');
    return records.find(record => record.id === 'classic-start-pikachu') || null;
  })).toMatchObject({
    id: 'classic-start-pikachu',
    domain: 'pokedex',
    originRunId: expect.any(String),
  });
  await page.getByRole('button', { name: 'Logros' }).click();
  await expect(page.locator('#acv-drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#acv-ach-list')).toContainText('Un inicio clásico');
});

test('silencia un logro permanente aunque vuelva a satisfacerlo en otra run', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('pokevoice-achievements-v1', JSON.stringify([
      { id: 'classic-start-pikachu', date: 100 },
    ]));
  });
  await page.reload();

  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');

  await expect(page.locator('.acv-toast').filter({ hasText: 'Un inicio clásico' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-achievements-v1') || '[]')
      .filter(entry => entry.id === 'classic-start-pikachu').length
  ))).toBe(1);
  await page.getByRole('button', { name: 'Logros' }).click();
  await expect(page.locator('#acv-ach-list')).toContainText('Un inicio clásico');
});

test('reinicia solo la run y explica qué conserva PokeDiscover', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await expect.poll(() => page.evaluate(() => (
    Object.keys(JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover.achievements).length
  ))).toBeGreaterThan(0);

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('se vaciarán los Pokémon registrados');
    expect(dialog.message()).toContain('Conservarás PokeDiscover completo');
    await dialog.accept();
  });
  if ((page.viewportSize()?.width ?? 1280) <= 600) {
    const mobileControls = page.getByRole('button', { name: 'Abrir controles' });
    await mobileControls.click();
    await page.getByRole('button', { name: 'Reiniciar progreso', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  }

  await expect(page.getByRole('button', { name: /0 descubiertos/ })).toBeVisible();
  await page.getByRole('button', { name: 'Logros' }).click();
  await expect(page.locator('#acv-ach-list')).toContainText('Un inicio clásico');
  await expect.poll(() => page.evaluate(() => (
    Boolean(JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover.achievements['classic-start-pikachu'])
  ))).toBe(true);
});

test('reserva el borrado total para una confirmación reforzada', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: /1 descubiertos/ })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir controles' }).click();
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('prompt');
    expect(dialog.message()).toContain('se eliminarán la Pokédex actual y PokeDiscover completo');
    expect(dialog.message()).toContain('Escribe BORRAR');
    await dialog.accept('BORRAR');
  });
  await page.getByRole('button', { name: 'Borrar todos los datos', exact: true }).click();

  await expect(page.getByRole('button', { name: /0 descubiertos/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1') || '{}');
    return {
      registered: save.pokedexRun?.registeredSpeciesIds?.length,
      achievements: Object.keys(save.pokeDiscover?.achievements || {}).length,
      ledger: Object.keys(save.pokeDiscover?.rewardLedger || {}).length,
      level: save.pokeDiscover?.trainerLevel,
    };
  })).toEqual({ registered: 0, achievements: 0, ledger: 0, level: 1 });
});

test('navega de forma circular por las tarjetas descubiertas', async ({ page }) => {
  await page.getByRole('button', { name: /0 descubiertos/ }).click();
  await expect(page.locator('.toast')).toHaveText('Aún no hay descubiertos en este filtro.');

  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await page.getByRole('button', { name: /1 descubiertos/ }).click();

  await expect(page.locator('.pokemon-card[data-id="25"]')).toHaveClass(/focused/);
});

test('ejecuta la secuencia visual declarada al descubrir', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('bulbasaur');
  await input.press('Enter');

  await expect(page.locator('.effect--leaf-burst')).toBeAttached();
  await expect(page.locator('.pokemon-card[data-id="1"]')).toHaveClass(/revealing/);
});
