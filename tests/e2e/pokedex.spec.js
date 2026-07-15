import { expect, test } from '@playwright/test';
import { mockPokemonApi, pokemonCatalogFixture } from '../fixtures/pokemonCatalog.js';

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
