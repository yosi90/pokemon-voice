import { expect, test } from '@playwright/test';
import { generationOneFixtureCount, mockPokemonApi } from '../fixtures/pokemonCatalog.js';

test('portada de referencia', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  await expect(page.locator('.pokemon-card')).toHaveCount(generationOneFixtureCount);
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('home.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
  });
});

test('drawer de Pokédex de referencia', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  await expect(page.locator('.pokemon-card')).toHaveCount(generationOneFixtureCount);
  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();
  await expect(page.locator('#pokedex-controls-drawer')).toHaveAttribute('aria-hidden', 'false');
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('pokedex-controls-drawer.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
  });
});
