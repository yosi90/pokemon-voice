import { expect, test } from '@playwright/test';
import { mockPokemonApi, pokemonCatalogFixture } from '../fixtures/pokemonCatalog.js';

test('portada de referencia', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  await expect(page.locator('.pokemon-card')).toHaveCount(pokemonCatalogFixture.results.length);
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('home.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
  });
});
