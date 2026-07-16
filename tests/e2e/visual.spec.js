import { expect, test } from '@playwright/test';
import { generationOneFixtureCount, mockPokemonApi } from '../fixtures/pokemonCatalog.js';

async function suppressProfessorIntroduction(page) {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.introduction.status = 'offered';
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
}

async function completeNarrativePage(page) {
  const box = page.locator('.narrative-box');
  await box.click();
  await box.click();
}

async function waitForNarrativeAssets(page) {
  await page.locator('.narrative-scene__background').evaluate(element => new Promise((resolve, reject) => {
    const match = getComputedStyle(element).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match) return resolve();
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = match[1];
    if (image.complete) resolve();
  }));
  await page.locator('.narrative-scene img').evaluateAll(images => Promise.all(
    images.map(image => image.complete ? image.decode?.().catch(() => {}) : new Promise(resolve => image.addEventListener('load', resolve, { once: true }))),
  ));
}

test('presentación del profesor Alcanfor', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('bulbasaur');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Abrir ficha de bulbasaur' }).click();
  await expect(page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' })).toBeVisible();
  await page.locator('.narrative-box').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await waitForNarrativeAssets(page);

  await expect(page).toHaveScreenshot('professor-introduction.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test('selección de protagonista de PokeDiscover', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('bulbasaur');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Abrir ficha de bulbasaur' }).click();
  await completeNarrativePage(page);
  await completeNarrativePage(page);
  await completeNarrativePage(page);
  const scene = page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' });
  await scene.locator('.narrative-box').click();
  await scene.getByRole('button', { name: '¡Sí, acepto!' }).click();
  await scene.locator('.narrative-box').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await waitForNarrativeAssets(page);

  await expect(page).toHaveScreenshot('trainer-selection.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });

  await scene.getByRole('button', { name: 'Soy una chica' }).click();
  await scene.locator('.narrative-box').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(scene.getByLabel('Nombre del entrenador')).toHaveValue('Guayota');
  await expect(page).toHaveScreenshot('trainer-name.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

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

test('cuatro Pokéballs pseudo-3D de referencia', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  await expect(page.locator('.pokemon-card')).toHaveCount(generationOneFixtureCount);
  await page.evaluate(() => {
    const variants = ['poke', 'super', 'ultra', 'master'];
    [...document.querySelectorAll('.pokemon-card')].slice(0, variants.length).forEach((card, index) => {
      card.classList.remove('ball-super', 'ball-ultra', 'ball-master');
      if (variants[index] !== 'poke') card.classList.add(`ball-${variants[index]}`);
      card.dataset.ball = variants[index];
    });
  });
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator('#grid')).toHaveScreenshot('pokeball-variants-3d.png', {
    animations: 'disabled',
    caret: 'hide',
  });
});

test('ficha eléctrica de Pokédex de referencia', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await suppressProfessorIntroduction(page);
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.toast, .acv-toast { display: none !important; }';
    document.head.append(style);
  });
  await page.getByRole('button', { name: 'Abrir ficha de pikachu' }).click();
  await expect(page.getByRole('dialog', { name: 'pikachu' })).toHaveAttribute('data-primary-type', 'electric');
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('pokemon-detail-electric.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
  });
});

test('ficha psíquica de Pokédex de referencia', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('mew');
  await input.press('Enter');
  await suppressProfessorIntroduction(page);
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.toast, .acv-toast { display: none !important; }';
    document.head.append(style);
  });
  await page.getByRole('button', { name: 'Abrir ficha de mew' }).click();
  await expect(page.getByRole('dialog', { name: 'mew' })).toHaveAttribute('data-motif', 'waves');
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('pokemon-detail-psychic.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
  });
});

test('galería de formas y apariencias de referencia', async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await suppressProfessorIntroduction(page);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.discoveredForms['pokemon-form:25:partner'] = {
      schemaVersion: 1,
      formId: 'pokemon-form:25:partner',
      speciesId: 25,
      discoveredAt: '2026-07-15T10:00:00.000Z',
      noteIds: ['note:conducta-juguetona'],
      originMapId: 'map:bosque-verde',
    };
    save.pokeDiscover.discoveredAppearances['pokemon-appearance:25:surfista'] = {
      schemaVersion: 1,
      appearanceId: 'pokemon-appearance:25:surfista',
      formId: 'pokemon-form:25:default',
      speciesId: 25,
      discoveredAt: '2026-07-15T11:00:00.000Z',
      noteIds: ['note:domina-las-olas'],
      originMissionId: 'mission:bahia-en-calma',
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
    const style = document.createElement('style');
    style.textContent = '.toast, .acv-toast { display: none !important; }';
    document.head.append(style);
  });
  await page.getByRole('button', { name: 'Abrir ficha de pikachu' }).click();
  await expect(page.getByText('3 descubiertas')).toBeVisible();
  await page.getByText('3 descubiertas').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('pokemon-detail-variants.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
  });
});
