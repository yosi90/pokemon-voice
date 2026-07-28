import { expect, test } from '@playwright/test';
import {
  mockPokemonApi,
  mockPokemonApiUnavailable,
  generationOneFixtureCount,
  pokemonCatalogFixture,
} from '../fixtures/pokemonCatalog.js';

async function setProfessorIntroduction(page, state) {
  await page.evaluate(introduction => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.introduction = { ...save.pokeDiscover.introduction, ...introduction };
    if (introduction.acceptedAt === null) delete save.pokeDiscover.introduction.acceptedAt;
    save.pokeDiscover.narrativeProgress = {
      schemaVersion: 1,
      pendingSequenceIds: [],
      completedSequenceIds: [],
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  }, state);
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
}

async function revealByText(page, name) {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill(name);
  await input.press('Enter');
  await expect(page.getByRole('button', { name: `Abrir ficha de ${name}` })).toBeVisible();
}

async function completeNarrativePage(page) {
  const scene = page.getByTestId('narrative-scene');
  const pageId = await scene.getAttribute('data-page-id');
  const box = scene.locator('.narrative-box');
  await box.click();
  if (await scene.count() === 0) return;
  if (await scene.getAttribute('data-page-id') === pageId) await box.click();
  await expect.poll(async () => (
    await scene.count() === 0 ? null : scene.getAttribute('data-page-id')
  )).not.toBe(pageId);
}

async function answerProfessorCall(page) {
  const call = page.getByRole('status', { name: 'Llamada entrante del profesor Alcanfor' });
  await expect(call).toBeVisible({ timeout: 30_000 });
  await call.getByRole('button', { name: 'Descolgar' }).click();
}

async function moveOneGridStep(page, runtime, key, coordinate, delta) {
  await expect(runtime).toHaveAttribute('data-step', 'idle');
  const before = Number(await runtime.getAttribute(`data-player-${coordinate}`));
  const expectedFacing = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  }[key];
  if (await runtime.getAttribute('data-facing') !== expectedFacing) {
    await page.keyboard.press(key);
    await expect(runtime).toHaveAttribute('data-facing', expectedFacing);
    expect(Number(await runtime.getAttribute(`data-player-${coordinate}`))).toBe(before);
  }
  await runtime.evaluate((element, movementKey) => new Promise(resolve => {
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: movementKey,
      code: movementKey,
      bubbles: true,
    }));
    requestAnimationFrame(() => {
      element.dispatchEvent(new KeyboardEvent('keyup', {
        key: movementKey,
        code: movementKey,
        bubbles: true,
      }));
      resolve();
    });
  }), key);
  await expect.poll(
    async () => Number(await runtime.getAttribute(`data-player-${coordinate}`)),
    { timeout: 10_000 },
  ).toBe(before + delta);
  await expect(runtime).toHaveAttribute('data-step', 'idle');
}

test.beforeEach(async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  await setProfessorIntroduction(page, {
    status: 'accepted',
    acceptedAt: '2026-07-16T12:00:00.000Z',
  });
  await expect(page.locator('.pokemon-card')).toHaveCount(generationOneFixtureCount);
});

test('Alcanfor se presenta desde la primera ficha y abre PokeDiscover sin conceder la primera misión', async ({ page }) => {
  test.setTimeout(90_000);
  await setProfessorIntroduction(page, {
    status: 'hidden',
    invitationCount: 0,
    declineCount: 0,
    nextEligibleDiscoveryCount: 5,
    acceptedAt: null,
  });
  await revealByText(page, 'bulbasaur');
  await page.getByRole('button', { name: 'Abrir ficha de bulbasaur' }).click();

  await expect(page.getByRole('dialog', { name: 'bulbasaur' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar ficha' }).click();
  await answerProfessorCall(page);

  const scene = page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' });
  await expect(scene).toBeVisible();
  await expect(scene.locator('.narrative-scene__background')).toHaveCSS('background-image', /Laboratorio-de-alcanfor\.png/);
  await expect(page.locator('#dock')).toHaveCount(0);
  await expect(page.locator('.discovery-console')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'bulbasaur' })).toHaveCount(0);
  await expect(page.locator('main')).toHaveAttribute('inert', '');

  await completeNarrativePage(page);
  await completeNarrativePage(page);
  await completeNarrativePage(page);
  await scene.locator('.narrative-box').click();
  await scene.getByRole('button', { name: '¡Sí, acepto!' }).click();
  await scene.locator('.narrative-box').click();
  await expect(scene.getByRole('button', { name: 'Soy un chico' })).toBeVisible();
  await expect(scene.getByRole('button', { name: 'Soy una chica' })).toBeVisible();
  await scene.getByRole('button', { name: 'Soy una chica' }).click();
  await scene.locator('.narrative-box').click();
  const trainerName = scene.getByLabel('Nombre del entrenador');
  await expect(trainerName).toHaveValue('Guayota');
  await trainerName.fill('Naira');
  await scene.getByRole('button', { name: 'Confirmar nombre' }).click();
  await completeNarrativePage(page);

  await expect(scene).toHaveCount(0);
  const professorButton = page.getByRole('button', { name: 'Profesor Alcanfor' });
  await expect(professorButton).toBeVisible();
  await expect(professorButton.locator('.nav-action-label')).toHaveText('Poke-Discover');
  const [dockBounds, professorButtonBounds] = await Promise.all([
    page.locator('#dock').boundingBox(),
    professorButton.boundingBox(),
  ]);
  expect(dockBounds).not.toBeNull();
  expect(professorButtonBounds).not.toBeNull();
  expect(professorButtonBounds.x).toBeGreaterThanOrEqual(dockBounds.x);
  expect(professorButtonBounds.x + professorButtonBounds.width).toBeLessThanOrEqual(dockBounds.x + dockBounds.width);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover);
  expect(persisted.introduction.status).toBe('accepted');
  expect(persisted.introduction.acceptedAt).toBeTruthy();
  expect(persisted.trainerProfile).toEqual({ schemaVersion: 1, avatarId: 'guayota', displayName: 'Naira' });
  expect(persisted.achievements['first-mission']).toBeUndefined();

  await answerProfessorCall(page);
  const emergency = page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' });
  await expect(emergency).toContainText('emergencia en el Bosque de Tegueste');
  await completeNarrativePage(page);
  await expect(emergency).toContainText('Elige un compañero de campo');
  await completeNarrativePage(page);

  const missions = page.getByRole('dialog', { name: 'PokeDiscover' });
  await expect(missions).toContainText('Llamada urgente');
  await expect(missions).toContainText('Alcanfor necesita ayuda en Tegueste');
  await expect(missions.getByRole('button', { name: 'Cerrar PokeDiscover' })).toHaveCount(0);
  await expect(missions.getByRole('button', { name: 'Inicio' })).toBeDisabled();
  await expect(missions.getByRole('button', { name: 'Encargos' })).toBeDisabled();
  await expect(missions.getByRole('button', { name: 'Tienda' })).toBeDisabled();
  const confirmCompanion = missions.getByRole('button', { name: 'Confirmar compañero y revisar encargo' });
  await expect(confirmCompanion).toBeDisabled();

  await page.reload();
  const reloadedVoiceModal = page.locator('#voice-support-modal');
  if (await reloadedVoiceModal.isVisible()) await reloadedVoiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(missions).toContainText('Alcanfor necesita ayuda en Tegueste');
  await expect(missions.getByRole('button', { name: 'Cerrar PokeDiscover' })).toHaveCount(0);
  await missions.locator('.companion-card').filter({ hasText: 'Bulbasaur' }).getByRole('button', { name: 'Elegir' }).click();
  await expect(confirmCompanion).toBeEnabled();
  await confirmCompanion.click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(
    '#/missions/mission%3Ategueste%3Ahelp-professor-camphor',
  );
  await expect(missions.getByRole('article', { name: 'Briefing: ¡Ayuda al profesor Alcanfor!' })).toBeVisible();
  const prepared = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')));
  expect(prepared.pendingMissionLaunch).toMatchObject({
    missionId: 'mission:tegueste:help-professor-camphor',
    checkpoint: 'ready',
  });
  expect(prepared.pokeDiscover.worldFlags['story:camphor-prologue-offered']).toBe(true);
  expect(prepared.pokeDiscover.achievements['first-mission']).toBeUndefined();
});

test('una adhesión anterior solicita el perfil al abrir Poke-Discover sin interrumpir la carga', async ({ page }) => {
  await setProfessorIntroduction(page, {
    status: 'accepted',
    acceptedAt: '2026-07-16T12:00:00.000Z',
  });
  await expect(page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  const scene = page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' });
  await expect(scene).toBeVisible();
  await scene.locator('.narrative-box').click();
  await scene.getByRole('button', { name: 'Soy un chico' }).click();
  await scene.locator('.narrative-box').click();
  await expect(scene.getByLabel('Nombre del entrenador')).toHaveValue('Achaman');
});

test('el prólogo sin compañero representa asalto, elección, rescate, científicos y Pineco en Phaser', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokedexRun.registeredSpeciesIds = [];
    save.pokedexRun.discoveryOrder = [];
    delete save.pokedexRun.selectedCompanion;
    delete save.pokedexRun.selectedCompanionFormId;
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokeDiscover.worldFlags['story:camphor-prologue-offered'] = true;
    save.pokeDiscover.narrativeProgress.completedSequenceIds = ['narrative:professor-camphor:forest-emergency'];
    save.pendingMissionLaunch = {
      schemaVersion: 1,
      missionId: 'mission:tegueste:help-professor-camphor',
      checkpoint: 'openingCinematic',
      offeredAt: '2026-07-22T12:00:00.000Z',
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
    window.location.hash = '#/expeditions/map%3Ategueste%3Acamphor-forest/room%3Ategueste-forest%3A02-04';
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();

  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  const runtime = preview.getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  const starterChoice = preview.getByRole('dialog', { name: 'Elegir primer compañero' });
  await expect(starterChoice).toBeVisible({ timeout: 15000 });
  await expect(runtime).toHaveAttribute('data-story-poke-ball-count', '3');
  await starterChoice.getByRole('button', { name: 'Charmander' }).click();

  await expect(preview.getByText('¡Rescate completado!')).toBeVisible({ timeout: 15000 });
  await expect(runtime).toHaveAttribute('data-last-sequence-cue-id', 'cue:camphor-prologue:complete');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')));
  expect(saved.pendingMissionLaunch).toBeUndefined();
  expect(saved.pokedexRun.selectedCompanion.formId).toBe('pokemon-form:4:default');
  expect(saved.activeExpeditionSession.missionRuntime).toMatchObject({
    checkpointId: 'checkpoint:camphor-prologue:free-roam',
    counters: { 'mission-counter:camphor:rattata-driven-away': 3 },
  });
  expect(saved.pokeDiscover.mapProgress['map:tegueste:camphor-forest'].completedMissionIds)
    .toContain('mission:tegueste:help-professor-camphor');
  expect(saved.pokeDiscover.mapProgress['map:tegueste:camphor-forest'].unlockedSecretIds)
    .toContain('secret:camphor-forest:pineco-tree');
});

test('el prólogo con compañero usa su rescate sin repetir la elección de inicial', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokedexRun.registeredSpeciesIds = [1];
    save.pokedexRun.discoveryOrder = [1];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:1:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:1:default';
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokeDiscover.worldFlags['story:camphor-prologue-offered'] = true;
    save.pokeDiscover.narrativeProgress.completedSequenceIds = ['narrative:professor-camphor:forest-emergency'];
    save.pendingMissionLaunch = {
      schemaVersion: 1,
      missionId: 'mission:tegueste:help-professor-camphor',
      checkpoint: 'ready',
      offeredAt: '2026-07-22T12:00:00.000Z',
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
    window.location.hash = '#/missions/mission%3Ategueste%3Ahelp-professor-camphor';
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Comenzar encargo' }).click();
  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  await expect(preview.getByRole('dialog', { name: 'Rescatar al profesor Alcanfor' })).toBeVisible({ timeout: 15000 });
  await expect(preview.getByRole('dialog', { name: 'Elegir primer compañero' })).toHaveCount(0);
  await preview.getByRole('button', { name: '¡Ayuda a Alcanfor!' }).click();
  await expect(preview.getByText('¡Rescate completado!')).toBeVisible({ timeout: 15000 });

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')));
  expect(saved.pokedexRun.selectedCompanion.formId).toBe('pokemon-form:1:default');
  expect(saved.activeExpeditionSession.missionRuntime.counters['mission-counter:camphor:rattata-driven-away']).toBe(3);
});

test('filtra compañeros por categoría y conserva forma y apariencia seleccionadas', async ({ page }) => {
  await mockPokemonApi(page, {
    extraEntries: [{ name: 'raichu', url: 'https://pokeapi.co/api/v2/pokemon/26/' }],
  });
  await page.goto('/');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokedexRun.registeredSpeciesIds = [25, 26, 152];
    save.pokedexRun.discoveryOrder = [25, 26, 152];
    save.pokeDiscover.introduction = {
      ...save.pokeDiscover.introduction,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
    };
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'guayota', displayName: 'Guayota' };
    save.pokeDiscover.discoveredForms['pokemon-form:26:alola'] = {
      schemaVersion: 1,
      formId: 'pokemon-form:26:alola',
      speciesId: 26,
      discoveredAt: new Date().toISOString(),
      noteIds: [],
    };
    save.pokeDiscover.discoveredAppearances['pokemon-appearance:25:surfista'] = {
      schemaVersion: 1,
      appearanceId: 'pokemon-appearance:25:surfista',
      formId: 'pokemon-form:25:default',
      speciesId: 25,
      discoveredAt: new Date().toISOString(),
      noteIds: [],
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  const pokeDiscover = page.getByRole('dialog', { name: 'PokeDiscover' });
  const homeHeight = (await pokeDiscover.boundingBox()).height;
  await page.getByRole('button', { name: 'Encargos' }).click();
  expect((await pokeDiscover.boundingBox()).height).toBe(homeHeight);
  await page.getByRole('button', { name: 'Compañero' }).click();
  expect((await pokeDiscover.boundingBox()).height).toBe(homeHeight);

  const category = page.getByLabel('Categoría');
  const generation = page.getByRole('combobox', { name: 'Filtrar por generación' });
  await expect(generation).toContainText('Kanto · Gen. 1 (4)');
  await expect(generation).toContainText('Johto · Gen. 2 (1)');
  await generation.selectOption('2');
  await expect(page.getByRole('heading', { name: 'Chikorita' })).toBeVisible();
  await expect(page.locator('.companion-card')).toHaveCount(1);
  await generation.selectOption('all');
  await expect(category).toContainText('Tercera evolución (2)');
  await expect(category).toContainText('Segunda evolución (2)');
  await category.selectOption('third-evolution');
  await expect(page.locator('.companion-card')).toHaveCount(2);
  const search = page.getByPlaceholder('Nombre o número');
  await search.fill('alola');
  await expect(page.getByRole('heading', { name: 'Raichu Alola' })).toBeVisible();
  await expect(page.locator('.companion-card')).toHaveCount(1);
  await category.selectOption('second-evolution');
  await search.fill('surfista');
  const surfista = page.locator('.companion-card').filter({ hasText: 'Pikachu surfista' });
  await expect(surfista).toHaveCount(1);
  await surfista.getByRole('button', { name: 'Elegir' }).click();

  const selection = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.selectedCompanion);
  expect(selection).toEqual({
    schemaVersion: 1,
    formId: 'pokemon-form:25:default',
    appearanceId: 'pokemon-appearance:25:surfista',
  });
  await page.getByRole('button', { name: 'Inicio' }).click();
  expect((await pokeDiscover.boundingBox()).height).toBe(homeHeight);
  await expect(page.getByText('Compañero actual')).toBeVisible();
  await expect(page.getByText('Pikachu surfista')).toBeVisible();
  await page.getByRole('button', { name: 'Tienda' }).click();
  expect((await pokeDiscover.boundingBox()).height).toBe(homeHeight);
  await expect(page.getByText('Pala de campo')).toBeVisible();
  await expect(page.getByText('Cepillo de arqueología')).toBeVisible();
  await expect(page.getByText('Bote plegable')).toBeVisible();
  expect(await pokeDiscover.locator('.professor-missions__body').evaluate(element => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
});

test('el tablero de encargos reúne briefing, recompensas y compañero antes de salir', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokedexRun.registeredSpeciesIds = [1];
    save.pokedexRun.discoveryOrder = [1];
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokeDiscover.worldFlags['story:camphor-prologue-offered'] = true;
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  const pokeDiscover = page.getByRole('dialog', { name: 'PokeDiscover' });
  await pokeDiscover.getByRole('button', { name: 'Encargos' }).click();
  const briefing = pokeDiscover.getByRole('article', { name: 'Briefing: ¡Ayuda al profesor Alcanfor!' });
  await expect(briefing).toContainText('Ahuyenta a los tres Pokémon que rodean al profesor.');
  await expect(briefing).toContainText('25 PX de entrenador');
  await expect(briefing).toContainText('25 Puntos de Descubrimiento');
  await expect(briefing).toContainText('Expedición libre en este mapa');
  await expect(briefing.getByRole('button', { name: 'Comenzar encargo' })).toBeDisabled();

  await briefing.getByRole('button', { name: 'Elegir compañero' }).click();
  const bulbasaur = pokeDiscover.locator('.companion-card').filter({ hasText: 'Bulbasaur' });
  await bulbasaur.getByRole('button', { name: 'Elegir' }).click();
  await pokeDiscover.getByRole('button', { name: 'Encargos' }).click();
  await expect(briefing).toContainText('Bulbasaur');
  await briefing.getByRole('button', { name: 'Comenzar encargo' }).click();

  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(
    '#/expeditions/map%3Ategueste%3Acamphor-forest/sector%3Ategueste-forest%3A02-04',
  );
  await expect(page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' })).toBeVisible();
});

test('carga el Bosque de Tegueste con personajes, Pokémon, movimiento y colisiones', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokedexRun.registeredSpeciesIds = [];
    save.pokedexRun.discoveryOrder = [];
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.route('**/tegueste-forest.adventure.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  }, { times: 1 });
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(
    '#/expeditions/map%3Ategueste%3Acamphor-forest/sector%3Ategueste-forest%3A02-04',
  );

  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('status')).toHaveText('¡Corriendo a ayudar al profesor!');
  const runtime = preview.getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-movement-inputs', 'keyboard');
  const controlDecorations = preview.locator('[data-control-decoration]');
  await expect(controlDecorations).toHaveCount(2);
  await expect(controlDecorations.locator('button, input, [role="button"]')).toHaveCount(0);
  for (const decoration of await controlDecorations.all()) {
    await expect(decoration).toHaveAttribute('aria-hidden', 'true');
    await expect(decoration).toHaveCSS('pointer-events', 'none');
  }
  const decorativePad = preview.locator('[data-control-decoration="direction-pad"]');
  const positionBeforeDecorationClick = await runtime.evaluate(element => ({
    x: element.getAttribute('data-player-x'),
    y: element.getAttribute('data-player-y'),
  }));
  await decorativePad.click({ force: true });
  await page.waitForTimeout(100);
  await expect.poll(() => runtime.evaluate(element => ({
    x: element.getAttribute('data-player-x'),
    y: element.getAttribute('data-player-y'),
  }))).toEqual(positionBeforeDecorationClick);
  await expect(preview.getByRole('status')).toHaveCount(0);
  await expect(runtime).toHaveAttribute('data-animation', 'playing');
  await expect(runtime).toHaveAttribute('data-map-id', 'map:tegueste:camphor-forest');
  await expect(runtime).toHaveAttribute('data-sector-id', 'sector:tegueste-forest:02-04');
  await expect(runtime).toHaveAttribute('data-actor-id', 'actor:rattata:left');
  await expect(runtime).toHaveAttribute('data-actor-grounding', 'pmd-shadow');
  await expect(runtime).toHaveAttribute('data-solid-actor-count', '7');
  await expect(runtime).toHaveAttribute('data-player-asset-id', 'character:trainer:achaman');
  await expect(runtime).toHaveAttribute('data-movement', 'grid');
  await expect(runtime).toHaveAttribute('data-undiscovered-actor-count', '4');
  await expect(runtime).toHaveAttribute('data-camera', 'static');
  await expect(runtime).toHaveAttribute('data-collision', 'arcade');
  await expect(runtime).toHaveAttribute('data-occlusion-layer', 'Above');
  await expect(runtime).toHaveAttribute('data-occluded-actor-count', '2');
  await expect(runtime).toHaveAttribute('data-occlusion-filter-count', '2');
  await expect(runtime).toHaveAttribute('data-ambient-tick-rate', '30');
  await expect(runtime).toHaveAttribute('data-ambient-assets', 'ready');
  await expect(runtime).toHaveAttribute('data-ambient-texture-count', '4');
  await expect(runtime).toHaveAttribute('data-ambient-sequence-count', '1');
  await expect.poll(async () => JSON.parse(await runtime.getAttribute('data-ambient-actors') || '[]')
    .some(actor => actor.animation !== 'Idle')).toBe(true);
  await expect(runtime).toHaveAttribute('data-ambient-beat-id', 'beat:gyarados:first-strike', { timeout: 10000 });
  expect(JSON.parse(await runtime.getAttribute('data-ambient-actors') || '[]')
    .filter(actor => actor.placementId.startsWith('actor:gyarados:'))
    .every(actor => !actor.missing && actor.frameHeight > 0)).toBe(true);
  await runtime.evaluate(element => element.dispatchEvent(new CustomEvent('pokevoice:map-ambient-control', {
    detail: { command: 'pause' },
  })));
  await expect(runtime).toHaveAttribute('data-ambient-state', 'suppressed');
  await runtime.evaluate(element => element.dispatchEvent(new CustomEvent('pokevoice:map-ambient-control', {
    detail: { command: 'resume' },
  })));
  await expect(runtime).toHaveAttribute('data-ambient-state', 'running');
  await expect(runtime).toHaveAttribute('data-animation', 'playing');
  const canvas = runtime.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('width', '480');
  await expect(canvas).toHaveAttribute('height', '320');
  const initialFrameChanges = Number(await runtime.getAttribute('data-actor-frame-changes'));
  await expect.poll(async () => Number(await runtime.getAttribute('data-actor-frame-changes')), {
    intervals: [100],
    timeout: 6000,
  }).toBeGreaterThan(initialFrameChanges);

  await moveOneGridStep(page, runtime, 'ArrowRight', 'x', 16);
  expect(Number(await runtime.getAttribute('data-player-x'))).toBe(200);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => Number(await runtime.getAttribute('data-player-y')), {
    intervals: [100],
    timeout: 10000,
  }).toBe(176);
  await page.waitForTimeout(250);
  expect(Number(await runtime.getAttribute('data-player-y'))).toBe(176);
  await page.keyboard.up('ArrowUp');
  expect(Number(await runtime.getAttribute('data-chained-step-count'))).toBeGreaterThan(0);

  await preview.getByRole('button', { name: 'Abandonar misión' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('');
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-ambient-cycle', '0');

  const initialX = Number(await runtime.getAttribute('data-player-x'));
  await page.keyboard.down('ArrowLeft');
  try {
    await expect.poll(async () => Number(await runtime.getAttribute('data-player-x'))).toBeLessThan(initialX);
    await expect(runtime).toHaveAttribute('data-last-blocked-step', 'preflight', { timeout: 30_000 });
  } finally {
    await page.keyboard.up('ArrowLeft');
  }
  await expect(runtime).toHaveAttribute('data-step', 'idle');
  const blockedX = Number(await runtime.getAttribute('data-player-x'));
  await page.waitForTimeout(250);
  expect(Number(await runtime.getAttribute('data-player-x'))).toBe(blockedX);
  expect(Number(await runtime.getAttribute('data-player-x'))).toBeGreaterThanOrEqual(0);
  expect((Number(await runtime.getAttribute('data-player-x')) - 8) % 16).toBe(0);

  const initialY = Number(await runtime.getAttribute('data-player-y'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => Number(await runtime.getAttribute('data-player-y'))).toBeLessThan(initialY);
  await page.keyboard.up('ArrowUp');
  await expect(runtime).toHaveAttribute('data-step', 'idle');
  expect(Number(await runtime.getAttribute('data-player-y')) % 16).toBe(0);
  await expect(runtime).toHaveAttribute('data-transition-count', '0');

  await page.keyboard.press('Enter');
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: 'Abandonar misión' }).click();
  await expect(preview).toHaveCount(0);
});

test('la expedición libre crea una sesión y al abandonarla muestra el informe sin borrar progreso', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokedexRun.registeredSpeciesIds = [25];
    save.pokedexRun.discoveryOrder = [25];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:25:default';
    save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'] = {
      schemaVersion: 1,
      mapId: 'map:tegueste:camphor-forest',
      freeExpeditionUnlocked: true,
      completedMissionIds: ['mission:tegueste:help-professor-camphor'],
      unlockedSecretIds: [],
      knownNpcIds: [],
      conversationIds: [],
      collectibleIds: [],
      knownHintIds: [],
      unlockedRouteIds: [],
      eligibleEncounterVisits: {},
      activeVariantIds: [],
      injectedEncounterIds: [],
      completedBehaviorTriggerIds: [],
      resolvedExpressionTriggers: {},
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();
  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  await expect(preview.getByTestId('technical-map-runtime')).toHaveAttribute(
    'data-runtime',
    'ready',
    { timeout: 30_000 },
  );
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).activeExpeditionSession)).toMatchObject({
    mapId: 'map:tegueste:camphor-forest',
    loadout: { companion: { formId: 'pokemon-form:25:default' } },
  });

  await preview.getByRole('button', { name: 'Abandonar misión' }).click();
  const report = page.getByRole('dialog', { name: 'De vuelta con Alcanfor' });
  await expect(report).toBeVisible();
  await expect(report).toContainText('conserva todo el progreso anterior');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).activeExpeditionSession)).toBeUndefined();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1'))
    .pokeDiscover.mapProgress['map:tegueste:camphor-forest'].freeExpeditionUnlocked)).toBe(true);
});

test('el compañero sigue la cuadrícula, conversa e intercambia casilla con movimiento clásico', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokedexRun.registeredSpeciesIds = [25];
    save.pokedexRun.discoveryOrder = [25];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:25:default';
    save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'] = {
      schemaVersion: 1,
      mapId: 'map:tegueste:camphor-forest',
      freeExpeditionUnlocked: true,
      completedMissionIds: ['mission:tegueste:help-professor-camphor'],
      unlockedSecretIds: [], knownNpcIds: [], conversationIds: [], collectibleIds: [], knownHintIds: [],
      unlockedRouteIds: [], eligibleEncounterVisits: {}, activeVariantIds: [], injectedEncounterIds: [],
      completedBehaviorTriggerIds: [], resolvedExpressionTriggers: {},
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();

  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  const runtime = preview.getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-companion-asset-id', 'pmd:0025-pikachu:default');

  const initialScrollY = await page.evaluate(() => window.scrollY);
  const initialPlayerPosition = await runtime.evaluate(element => ({
    x: element.getAttribute('data-player-x'),
    y: element.getAttribute('data-player-y'),
  }));
  await page.keyboard.press('ArrowLeft');
  await expect(runtime).toHaveAttribute('data-facing', 'left');
  await expect.poll(async () => runtime.evaluate(element => ({
    x: element.getAttribute('data-player-x'),
    y: element.getAttribute('data-player-y'),
  }))).toEqual(initialPlayerPosition);
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollY);
  await expect(preview.getByRole('button', { name: 'Hablar con tu compañero' })).toBeVisible();
  await preview.getByRole('button', { name: 'Hablar con tu compañero' }).click();
  await expect(preview.getByRole('dialog', { name: 'Hablar con Pikachu' })).toContainText('feliz de viajar contigo');
  await preview.getByRole('button', { name: 'Seguir explorando' }).click();

  const originalPlayerX = Number(await runtime.getAttribute('data-player-x'));
  const originalCompanionX = Number(await runtime.getAttribute('data-companion-x'));
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(35);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => Number(await runtime.getAttribute('data-player-x'))).toBe(originalCompanionX);
  await expect.poll(async () => Number(await runtime.getAttribute('data-companion-x'))).toBe(originalPlayerX);
  await expect(runtime).toHaveAttribute('data-companion-facing', 'left');

  const frameChangesBeforeWalking = Number(await runtime.getAttribute('data-companion-frame-changes'));
  const yBeforeWalking = Number(await runtime.getAttribute('data-player-y'));
  await page.keyboard.down('ArrowDown');
  try {
    await expect.poll(async () => Number(await runtime.getAttribute('data-player-y'))).toBeGreaterThan(yBeforeWalking);
    await expect.poll(async () => runtime.getAttribute('data-companion-animation')).toBe('Walk');
    await expect.poll(async () => Number(await runtime.getAttribute('data-companion-frame-changes')))
      .toBeGreaterThan(frameChangesBeforeWalking);

    const xBeforeOverride = Number(await runtime.getAttribute('data-player-x'));
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => Number(await runtime.getAttribute('data-player-x'))).toBeGreaterThan(xBeforeOverride);
    await page.keyboard.up('ArrowRight');
    await expect.poll(async () => runtime.getAttribute('data-facing')).toBe('down');
  } finally {
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowDown');
  }
  await expect.poll(async () => runtime.getAttribute('data-companion-animation')).toBe('Idle');
});

test('usa una Poké Ball provisional si el compañero aún no tiene sprite PMD', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokedexRun.registeredSpeciesIds = [133];
    save.pokedexRun.discoveryOrder = [133];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:133:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:133:default';
    save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'] = {
      schemaVersion: 1,
      mapId: 'map:tegueste:camphor-forest',
      freeExpeditionUnlocked: false,
      completedMissionIds: [],
      unlockedSecretIds: [], knownNpcIds: [], conversationIds: [], collectibleIds: [], knownHintIds: [],
      unlockedRouteIds: [], eligibleEncounterVisits: {}, activeVariantIds: [], injectedEncounterIds: [],
      completedBehaviorTriggerIds: [], resolvedExpressionTriggers: {},
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();
  const runtime = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' })
    .getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-companion-asset-id', 'placeholder:pokeball');
  await expect(runtime).toHaveAttribute('data-companion-form-id', 'pokemon-form:133:default');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).activeExpeditionSession)).toBeUndefined();
});

test('la previsualización técnica ejecuta la emboscada de madriguera sin escribir progreso', async ({ page }) => {
  test.setTimeout(90_000);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokedexRun.registeredSpeciesIds = [1];
    save.pokedexRun.discoveryOrder = [1];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:1:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:1:default';
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();
  const runtime = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' })
    .getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });

  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 6; index += 1) {
    await moveOneGridStep(page, runtime, 'ArrowRight', 'x', 16);
  }
  await page.keyboard.press('ArrowUp');
  for (let index = 0; index < 2; index += 1) {
    await moveOneGridStep(page, runtime, 'ArrowUp', 'y', -16);
  }

  await expect(runtime).toHaveAttribute(
    'data-last-companion-sequence-id',
    'sequence:tegueste:burrow-middle:rattata-ambush',
  );
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover);
  expect(progress.trainerExperience).toBe(0);
  expect(progress.discoveryPoints).toBe(0);
  expect(progress.mapProgress['map:tegueste:camphor-forest']?.unlockedSecretIds ?? []).toEqual([]);
});

test('Ekans ejecuta la secuencia de madriguera y cobra secreto y logro una sola vez', async ({ page }) => {
  test.setTimeout(90_000);
  await mockPokemonApi(page, {
    extraEntries: [{ name: 'ekans', url: 'https://pokeapi.co/api/v2/pokemon/23/' }],
  });
  await page.goto('/');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokedexRun.registeredSpeciesIds = [23];
    save.pokedexRun.discoveryOrder = [23];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:23:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:23:default';
    save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'] = {
      schemaVersion: 1,
      mapId: 'map:tegueste:camphor-forest',
      freeExpeditionUnlocked: true,
      completedMissionIds: ['mission:tegueste:help-professor-camphor'],
      unlockedSecretIds: [], knownNpcIds: [], conversationIds: [], collectibleIds: [], knownHintIds: [],
      unlockedRouteIds: [], eligibleEncounterVisits: {}, activeVariantIds: [], injectedEncounterIds: [],
      completedBehaviorTriggerIds: [], resolvedExpressionTriggers: {},
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();
  const runtime = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' })
    .getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1'))
    .activeExpeditionSession?.loadout?.companion?.formId)).toBe('pokemon-form:23:default');
  await expect(runtime).toHaveAttribute('data-companion-form-id', 'pokemon-form:23:default');
  await runtime.evaluate(element => element.dispatchEvent(new CustomEvent('pokevoice:map-companion-sequence-request', {
    detail: { triggerId: 'behavior:tegueste:burrow-middle:snake-intimidation' },
  })));
  await expect(runtime).toHaveAttribute('data-companion-sequence-id', 'sequence:tegueste:burrow-middle:snake-intimidation');
  await expect.poll(
    async () => runtime.getAttribute('data-last-companion-sequence-animation'),
    { timeout: 15_000 },
  ).toBe('Eat');
  await expect.poll(async () => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      secret: save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'].unlockedSecretIds
        .includes('secret:tegueste-forest:burrow-intimidation'),
      achievement: Boolean(save.pokeDiscover.achievements['cold-blooded']),
      experience: save.pokeDiscover.trainerExperience,
      points: save.pokeDiscover.discoveryPoints,
    };
  }), { timeout: 40_000 }).toEqual({ secret: true, achievement: true, experience: 10, points: 10 });
  await expect(runtime).toHaveAttribute('data-control-priority', 'player');
  await runtime.evaluate(element => element.dispatchEvent(new CustomEvent('pokevoice:map-companion-sequence-request', {
    detail: { triggerId: 'behavior:tegueste:burrow-middle:snake-intimidation' },
  })));
  await expect(runtime).not.toHaveAttribute('data-companion-sequence-id', /.+/);
  await expect.poll(async () => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return [save.pokeDiscover.trainerExperience, save.pokeDiscover.discoveryPoints];
  })).toEqual([10, 10]);
});

test('Geodude resuelve Tumba Rocas desde la capacidad declarativa del loadout', async ({ page }) => {
  await mockPokemonApi(page, {
    extraEntries: [{ name: 'geodude', url: 'https://pokeapi.co/api/v2/pokemon/74/' }],
  });
  await page.goto('/');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokeDiscover.trainerLevel = 3;
    save.pokedexRun.registeredSpeciesIds = [74];
    save.pokedexRun.discoveryOrder = [74];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:74:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:74:default';
    save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'] = {
      schemaVersion: 1,
      mapId: 'map:tegueste:camphor-forest',
      freeExpeditionUnlocked: true,
      completedMissionIds: ['mission:tegueste:help-professor-camphor'],
      unlockedSecretIds: [], knownNpcIds: [], conversationIds: [], collectibleIds: [], knownHintIds: [],
      unlockedRouteIds: [], eligibleEncounterVisits: {}, activeVariantIds: [], injectedEncounterIds: [],
      completedBehaviorTriggerIds: [], resolvedExpressionTriggers: {},
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();
  const runtime = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' })
    .getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-companion-form-id', 'pokemon-form:74:default');

  await runtime.evaluate(element => element.dispatchEvent(new CustomEvent('pokevoice:map-companion-sequence-request', {
    detail: { triggerId: 'behavior:tegueste:burrow-left:rock-tomb' },
  })));
  await expect(runtime).toHaveAttribute('data-last-companion-sequence-id', 'sequence:tegueste:burrow-left:rock-tomb');
  await expect.poll(async () => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      completed: save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'].completedBehaviorTriggerIds
        .includes('behavior:tegueste:burrow-left:rock-tomb'),
      secret: save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'].unlockedSecretIds
        .includes('secret:tegueste-forest:burrow-intimidation'),
      experience: save.pokeDiscover.trainerExperience,
      points: save.pokeDiscover.discoveryPoints,
    };
  }), { timeout: 20_000 }).toEqual({ completed: true, secret: true, experience: 10, points: 10 });
});

test('resuelve expresiones por texto y análisis acústico local sin conservar audio', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokedexRun.registeredSpeciesIds = [25];
    save.pokedexRun.discoveryOrder = [25];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:25:default';
    save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'] = {
      schemaVersion: 1,
      mapId: 'map:tegueste:camphor-forest',
      freeExpeditionUnlocked: true,
      completedMissionIds: ['mission:tegueste:help-professor-camphor'],
      unlockedSecretIds: [],
      knownNpcIds: [],
      conversationIds: [],
      collectibleIds: [],
      knownHintIds: [],
      unlockedRouteIds: [],
      eligibleEncounterVisits: {},
      activeVariantIds: [],
      injectedEncounterIds: [],
      completedBehaviorTriggerIds: [],
      resolvedExpressionTriggers: {},
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();

  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  const runtime = preview.getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await runtime.evaluate(element => element.dispatchEvent(new CustomEvent('pokevoice:map-expression-started', {
    detail: { trigger: {
      schemaVersion: 1,
      triggerId: 'expression:tegueste:compliment-cottonee',
      activationRequirement: { kind: 'trainerLevel', minimum: 1 },
      inputMethods: ['voice', 'text', 'contextAction'],
      matchAny: [{ kind: 'intent', intent: 'compliment', examples: ['eres adorable'] }],
      knownHintIds: [],
      successSequenceId: 'sequence:tegueste:cottonee-happy',
      fallbackActionId: 'action:tegueste:smile-at-cottonee',
      fallbackLabel: 'Sonreír y saludar',
      prompt: 'Hablarle a Cottonee',
      successText: 'Cottonee gira feliz: parece que le ha gustado.',
      rewardOriginId: 'reward:tegueste:compliment-cottonee',
      rewardPackageId: 'reward-package:map-secret',
      completionEffects: { unlockSecretIds: ['secret:tegueste-forest:compliment-cottonee'] },
    } },
  })));

  await expect(preview.getByText('Puedes hablar, escribir o usar la alternativa accesible.')).toBeVisible();
  const input = preview.getByPlaceholder('Dile algo…');
  await input.fill('eres adorable');
  await input.press('Enter');
  await expect(preview.getByText(/He entendido: “eres adorable”/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(JSON.parse(localStorage.getItem('pokevoice-save-v1'))
    .pokeDiscover.mapProgress['map:tegueste:camphor-forest']
    .resolvedExpressionTriggers['expression:tegueste:compliment-cottonee']))).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover;
    return {
      secret: progress.mapProgress['map:tegueste:camphor-forest'].unlockedSecretIds
        .includes('secret:tegueste-forest:compliment-cottonee'),
      achievement: Boolean(progress.achievements['first-map-secret']),
      experience: progress.trainerExperience,
      points: progress.discoveryPoints,
    };
  })).toEqual({ secret: true, achievement: true, experience: 15, points: 15 });
  await expect(preview.getByText('Hablarle a Cottonee')).toHaveCount(0, { timeout: 3000 });

  await page.evaluate(() => {
    window.__acousticTracksStopped = 0;
    window.__acousticContextClosed = false;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => { window.__acousticTracksStopped += 1; } }],
        }),
      },
    });
    class FakeAudioContext {
      sampleRate = 48000;
      createAnalyser() {
        return {
          fftSize: 2048,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData(samples) {
            for (let index = 0; index < samples.length; index += 1) {
              samples[index] = Math.sin(2 * Math.PI * 240 * index / 48000) * 0.3;
            }
          },
          disconnect() {},
        };
      }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      async close() { window.__acousticContextClosed = true; }
    }
    window.AudioContext = FakeAudioContext;
  });

  await runtime.evaluate(element => element.dispatchEvent(new CustomEvent('pokevoice:map-expression-started', {
    detail: { trigger: {
      schemaVersion: 1,
      triggerId: 'expression:tegueste:scare-cramorant',
      activationRequirement: { kind: 'trainerLevel', minimum: 1 },
      inputMethods: ['voice', 'contextAction'],
      matchAny: [{ kind: 'acoustic', feature: 'loudness', minimumLevel: 0.62, minimumDurationMs: 500 }],
      knownHintIds: [],
      successSequenceId: 'sequence:tegueste:cramorant-startled',
      fallbackActionId: 'action:tegueste:wave-arms-at-cramorant',
      fallbackLabel: 'Agitar los brazos',
      prompt: 'Espantar a Cramorant',
      successText: 'Cramorant da un respingo y se aparta, muy ofendido.',
      rewardOriginId: 'reward:tegueste:scare-cramorant',
      rewardPackageId: 'reward-package:map-secret',
      completionEffects: { unlockSecretIds: ['secret:tegueste-forest:scare-cramorant'] },
    } },
  })));
  await expect(preview.getByText(/El análisis dura menos de dos segundos/)).toBeVisible();
  await expect(preview.getByPlaceholder('Dile algo…')).toHaveCount(0);
  const acousticButton = preview.getByRole('button', { name: 'Analizar sonido localmente' });
  await acousticButton.click();
  await expect(acousticButton).toBeDisabled();
  await expect(preview.getByText(/Volumen \d+%/)).toBeVisible({ timeout: 5000 });
  await expect(preview.getByText(/Cramorant da un respingo/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    stopped: window.__acousticTracksStopped,
    closed: window.__acousticContextClosed,
  }))).toEqual(expect.objectContaining({ stopped: 1, closed: true }));
  const acousticRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1'))
    .pokeDiscover.mapProgress['map:tegueste:camphor-forest']
    .resolvedExpressionTriggers['expression:tegueste:scare-cramorant']);
  expect(acousticRecord).toMatchObject({ method: 'voice' });
  expect(JSON.stringify(acousticRecord)).not.toContain('loudness');
  expect(await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover;
    return {
      secrets: progress.mapProgress['map:tegueste:camphor-forest'].unlockedSecretIds,
      experience: progress.trainerExperience,
      points: progress.discoveryPoints,
    };
  })).toEqual({
    secrets: [
      'secret:tegueste-forest:compliment-cottonee',
      'secret:tegueste-forest:scare-cramorant',
    ],
    experience: 30,
    points: 30,
  });
  expect(await preview.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('movimiento reducido conserva overlays y poses ambientales estáticas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();

  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  const runtime = preview.getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-ambient-state', 'reduced-motion');
  await expect(runtime).toHaveAttribute('data-ambient-assets', 'skipped');
  await expect(runtime).toHaveAttribute('data-ambient-sequence-count', '0');
  await expect(runtime).toHaveAttribute('data-occluded-actor-count', '2');
  await expect(runtime).toHaveAttribute('data-ambient-cycle', '0');
});

test('habla con Alcanfor mediante la interacción contextual y bloquea el mapa durante el diálogo', async ({ page }) => {
  test.setTimeout(90_000);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    save.pokedexRun.registeredSpeciesIds = [25];
    save.pokedexRun.discoveryOrder = [25];
    save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
    save.pokedexRun.selectedCompanionFormId = 'pokemon-form:25:default';
    save.pokeDiscover.mapProgress['map:tegueste:camphor-forest'] = {
      schemaVersion: 1,
      mapId: 'map:tegueste:camphor-forest',
      freeExpeditionUnlocked: true,
      completedMissionIds: ['mission:tegueste:help-professor-camphor'],
      unlockedSecretIds: [], knownNpcIds: [], conversationIds: [], collectibleIds: [], knownHintIds: [],
      unlockedRouteIds: [], eligibleEncounterVisits: {}, activeVariantIds: [], injectedEncounterIds: [],
      completedBehaviorTriggerIds: [], resolvedExpressionTriggers: {},
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();

  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  const runtime = preview.getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await moveOneGridStep(page, runtime, 'ArrowRight', 'x', 16);
  await page.keyboard.down('ArrowUp');
  const prompt = preview.getByRole('button', { name: /Hablar con Alcanfor/ });
  await expect(prompt).toBeVisible({ timeout: 10000 });
  await page.keyboard.up('ArrowUp');

  await page.keyboard.press('e');
  const dialogue = preview.getByRole('dialog', { name: 'Conversación con Profesor Alcanfor' });
  await expect(dialogue).toContainText('Esos Rattata llevan un rato siguiendo mi mochila');
  const dialogueLayout = await dialogue.evaluate(element => {
    const viewport = element.closest('.map-concept-preview__viewport').getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return {
      leftMargin: box.left - viewport.left,
      rightMargin: viewport.right - box.right,
      bottomMargin: viewport.bottom - box.bottom,
      nameFont: Number.parseFloat(getComputedStyle(element.querySelector('strong')).fontSize),
      textFont: Number.parseFloat(getComputedStyle(element.querySelector('p')).fontSize),
      buttonFont: Number.parseFloat(getComputedStyle(element.querySelector('button')).fontSize),
    };
  });
  expect(dialogueLayout.leftMargin).toBeGreaterThanOrEqual(8);
  expect(dialogueLayout.rightMargin).toBeGreaterThanOrEqual(8);
  expect(dialogueLayout.bottomMargin).toBeGreaterThanOrEqual(8);
  expect(dialogueLayout.nameFont).toBeGreaterThanOrEqual(8);
  expect(dialogueLayout.textFont).toBeGreaterThanOrEqual(8);
  expect(dialogueLayout.buttonFont).toBeGreaterThanOrEqual(7);
  await expect(runtime).toHaveAttribute('data-control-priority', 'interaction');
  await expect(runtime).toHaveAttribute('data-ambient-state', 'interaction');
  const lockedX = await runtime.getAttribute('data-player-x');
  await page.keyboard.press('ArrowLeft');
  await expect(runtime).toHaveAttribute('data-player-x', lockedX ?? '');

  await dialogue.getByRole('button', { name: 'Siguiente' }).click();
  await expect(dialogue).toContainText('Tu compañero también podrá ayudarte');
  await dialogue.getByRole('button', { name: 'Siguiente' }).click();
  await expect(dialogue).toContainText('un ruido decidido o un gesto amplio');
  await dialogue.getByRole('button', { name: 'Terminar' }).click();
  await expect(dialogue).toHaveCount(0);
  await expect(runtime).toHaveAttribute('data-control-priority', 'player');
  await expect(runtime).toHaveAttribute('data-ambient-state', 'running');
  await expect.poll(() => page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('pokevoice-save-v1'))
      .pokeDiscover.mapProgress['map:tegueste:camphor-forest'];
    return {
      npcIds: progress.knownNpcIds,
      conversationIds: progress.conversationIds,
      hintIds: progress.knownHintIds,
    };
  })).toEqual({
    npcIds: ['npc:tegueste:professor-alcanfor'],
    conversationIds: ['conversation:tegueste:professor-warning'],
    hintIds: ['hint:tegueste:rattata-follow-food', 'hint:tegueste:cramorant-startle'],
  });

  await expect(prompt).toBeVisible();
  await prompt.click();
  await expect(dialogue).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogue).toHaveCount(0);
  await expect(preview).toBeVisible();
});

test('voz y texto de expedición solo identifican especies presentes en la habitación', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__mapSpeechInstances = [];
    window.__mapCryPlays = [];
    window.Audio = class FakeAudio {
      constructor(src) { this.src = src; }
      addEventListener() {}
      async play() { window.__mapCryPlays.push(this.src); }
    };
    class FakeSpeechRecognition {
      constructor() { window.__mapSpeechInstances.push(this); }
      start() { this.started = true; }
      stop() { this.started = false; this.onend?.(); }
      emit(transcript) {
        const result = [{ transcript, confidence: 1 }];
        result.isFinal = true;
        this.onresult?.({ resultIndex: 0, results: [result] });
      }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });
  await page.route('https://pokeapi.co/api/v2/pokemon/546', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ id: 546, name: 'cottonee', cries: { latest: 'https://audio.test/cottonee.ogg' } }),
  }));
  await page.route('https://audio.test/cottonee.ogg', route => route.fulfill({
    contentType: 'audio/ogg',
    body: 'OggS',
  }));
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.trainerProfile = { schemaVersion: 1, avatarId: 'achaman', displayName: 'Achaman' };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Profesor Alcanfor' }).click();
  await page.getByRole('button', { name: 'Probar escenario' }).click();

  const preview = page.getByRole('dialog', { name: '¡Ayuda al profesor Alcanfor!' });
  const runtime = preview.getByTestId('technical-map-runtime');
  await expect(runtime).toHaveAttribute('data-runtime', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-undiscovered-actor-count', '4');
  await preview.getByRole('button', { name: 'Identificar Pokémon por voz' }).click();
  await expect(runtime).toBeFocused();
  await expect(preview.getByRole('button', { name: 'Detener identificación por voz' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.__mapSpeechInstances[0].emit('cottonee'));
  await expect(runtime).toHaveAttribute('data-undiscovered-actor-count', '3');
  expect(pageErrors).toEqual([]);
  await expect.poll(() => page.evaluate(() => ({
    registered: JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.registeredSpeciesIds.includes(546),
    guessed: JSON.parse(localStorage.getItem('pokevoice-guessed-v1') || '[]').includes(546),
    cries: window.__mapCryPlays.length,
  }))).toEqual({ registered: true, guessed: true, cries: 1 });

  const writtenName = preview.getByLabel('Nombre del Pokémon visible');
  await writtenName.fill('cramorant');
  await writtenName.press('Enter');
  await expect(runtime).toBeFocused();
  const facingBeforeKeyboardResume = await runtime.getAttribute('data-facing');
  const resumeKey = facingBeforeKeyboardResume === 'right' ? 'ArrowLeft' : 'ArrowRight';
  const resumedFacing = resumeKey === 'ArrowRight' ? 'right' : 'left';
  await page.keyboard.press(resumeKey);
  await expect(runtime).toHaveAttribute('data-facing', resumedFacing);
  await expect(runtime).toHaveAttribute('data-undiscovered-actor-count', '2');
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.registeredSpeciesIds
  ))).toContain(845);

  await writtenName.fill('rattata');
  await writtenName.press('Enter');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.registeredSpeciesIds
  ))).not.toContain(19);
  await expect(runtime).toHaveAttribute('data-undiscovered-actor-count', '2');

  await writtenName.fill('pikachu');
  await writtenName.press('Enter');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.registeredSpeciesIds
  ))).not.toContain(25);
  await expect(runtime).toHaveAttribute('data-undiscovered-actor-count', '2');
});

test('el quinto descubrimiento fuerza la invitación y tres negativas la aplazan', async ({ page }) => {
  test.setTimeout(90_000);
  await setProfessorIntroduction(page, {
    status: 'hidden',
    invitationCount: 0,
    declineCount: 0,
    nextEligibleDiscoveryCount: 5,
    acceptedAt: null,
  });
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokedexRun.registeredSpeciesIds = [1, 2, 3, 4];
    save.pokedexRun.discoveryOrder = [1, 2, 3, 4];
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
    localStorage.setItem('pokevoice-guessed-v1', JSON.stringify([1, 2, 3, 4]));
  });
  await page.reload();
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('squirtle');
  await input.press('Enter');

  await expect(page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' })).toHaveCount(0);
  await answerProfessorCall(page);
  const scene = page.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' });
  await expect(scene).toBeVisible();
  await completeNarrativePage(page);
  await completeNarrativePage(page);
  await completeNarrativePage(page);
  await scene.locator('.narrative-box').click();
  await scene.getByRole('button', { name: 'No, gracias' }).click();
  await completeNarrativePage(page);
  await scene.locator('.narrative-box').click();
  await scene.getByRole('button', { name: 'Sigo diciendo que no' }).click();
  await completeNarrativePage(page);
  await scene.locator('.narrative-box').click();
  await scene.getByRole('button', { name: 'Ahora no' }).click();
  await completeNarrativePage(page);

  await expect(scene).toHaveCount(0);
  const postponed = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover.introduction);
  expect(postponed).toMatchObject({ status: 'postponed', declineCount: 3, nextEligibleDiscoveryCount: 6 });

  await page.getByRole('button', { name: 'Abrir ficha de bulbasaur' }).click();
  await expect(page.getByRole('dialog', { name: 'bulbasaur' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar ficha' }).click();
  await input.fill('eevee');
  await input.press('Enter');
  await answerProfessorCall(page);
  await expect(scene).toContainText('¡Otra captura para esa Pokédex!');
});

test('una llamada de Alcanfor detiene el reconocimiento de voz antes de poder descolgar', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speechRecognitionInstances = [];
    class FakeSpeechRecognition {
      constructor() {
        window.__speechRecognitionInstances.push(this);
      }
      start() { this.started = true; }
      stop() {
        this.started = false;
        this.stopped = true;
        this.onend?.();
      }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
      },
    });
  });
  await setProfessorIntroduction(page, {
    status: 'hidden',
    invitationCount: 0,
    declineCount: 0,
    nextEligibleDiscoveryCount: 5,
    acceptedAt: null,
  });
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokedexRun.registeredSpeciesIds = [1, 2, 3, 4];
    save.pokedexRun.discoveryOrder = [1, 2, 3, 4];
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
    localStorage.setItem('pokevoice-guessed-v1', JSON.stringify([1, 2, 3, 4]));
  });
  await page.reload();
  const mic = page.getByRole('button', { name: 'Escuchar por micrófono' });
  await mic.click();
  await expect(page.getByRole('button', { name: 'Parar escucha' })).toBeVisible();

  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('squirtle');
  await input.press('Enter');
  await expect(page.getByRole('status', { name: 'Llamada entrante del profesor Alcanfor' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Escuchar por micrófono' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__speechRecognitionInstances.at(-1)?.stopped)).toBe(true);
});

test('permite descubrir por texto y persiste el resultado', async ({ page }) => {
  await page.getByPlaceholder('Escribe un nombre y pulsa Enter.').fill('pikachu');
  await page.getByPlaceholder('Escribe un nombre y pulsa Enter.').press('Enter');

  await expect(page.getByRole('button', { name: 'Abrir ficha de pikachu' })).toBeVisible();
  await expect(page.getByRole('button', { name: /1 descubiertos/ })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('pikachu descubierto (#0025)');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pokevoice-guessed-v1')))
    .toBe('[25]');
});

test('abre una ficha clasificada sin revelar un Pokémon desconocido', async ({ page }) => {
  const card = page.getByRole('button', { name: 'Abrir ficha de #0001' });
  await card.click();

  const modal = page.getByRole('dialog', { name: 'DATOS CLASIFICADOS' });
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute('data-primary-type', 'unknown');
  await expect(modal.getByText('Nombra a este Pokémon para desbloquear su registro.')).toBeVisible();
  await expect(modal.getByText('ACCESO DENEGADO')).toHaveCount(4);
  await expect(modal.getByRole('img')).toHaveCount(0);
});

test('varía de forma estable los bloqueos narrativos entre entradas', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir ficha de #0002' }).click();
  let modal = page.getByRole('dialog', { name: 'DATOS CLASIFICADOS' });
  await expect(modal.getByText(/Team Rocket/)).toBeVisible();
  await modal.getByRole('button', { name: 'Cerrar ficha' }).click();

  await page.getByRole('button', { name: 'Abrir ficha de #0003' }).click();
  modal = page.getByRole('dialog', { name: 'DATOS CLASIFICADOS' });
  await expect(modal.getByText(/SERVIDOR SIN RESPUESTA/)).toBeVisible();
  await modal.getByRole('button', { name: 'Cerrar ficha' }).click();

  await page.getByRole('button', { name: 'Abrir ficha de #0004' }).click();
  modal = page.getByRole('dialog', { name: 'DATOS CLASIFICADOS' });
  await expect(modal.getByText(/leyenda/)).toBeVisible();
});

test('tematiza la ficha registrada por tipo y restaura el foco al cerrarla', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  const card = page.getByRole('button', { name: 'Abrir ficha de pikachu' });
  await card.click();

  const modal = page.getByRole('dialog', { name: 'pikachu' });
  await expect(modal).toHaveAttribute('data-primary-type', 'electric');
  await expect(modal).toHaveAttribute('data-motif', 'bolts');
  await expect(modal.getByText('Eléctrico', { exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Reproducir cry' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cerrar ficha' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(card).toBeFocused();
});

test('usa el segundo tipo como acento sin sustituir la identidad primaria', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('bulbasaur');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Abrir ficha de bulbasaur' }).click();

  const modal = page.getByRole('dialog', { name: 'bulbasaur' });
  await expect(modal).toHaveAttribute('data-primary-type', 'grass');
  await expect(modal).toHaveAttribute('data-secondary-type', 'poison');
  await expect(modal.getByText('Planta', { exact: true })).toBeVisible();
  await expect(modal.getByText('Veneno', { exact: true })).toBeVisible();
});

test('ningún motivo de tipo altera el tamaño desplazable del modal', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Abrir ficha de pikachu' }).click();

  const measurements = await page.evaluate(() => {
    const motifs = [
      'rings', 'flame', 'sea', 'bolts', 'leaves', 'frost', 'fists', 'bubbles', 'quake',
      'currents', 'waves', 'web', 'mountains', 'eyes', 'scales', 'shadows', 'plates', 'gems',
    ];
    const panel = document.querySelector('.pokemon-detail-panel');
    return motifs.map(motif => {
      panel.dataset.motif = motif;
      panel.scrollLeft = 9999;
      return {
        motif,
        horizontalOverflow: panel.scrollWidth - panel.clientWidth,
        scrollLeft: panel.scrollLeft,
        scrollHeight: panel.scrollHeight,
      };
    });
  });

  expect(measurements.every(item => item.horizontalOverflow <= 1 && item.scrollLeft === 0)).toBe(true);
  expect(new Set(measurements.map(item => item.scrollHeight)).size).toBe(1);
});

test('mantiene registro e investigación como ejes independientes', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.sightings = [25];
    save.pokeDiscover.researchBySpecies[25] = {
      schemaVersion: 1,
      speciesId: 25,
      status: 'partial',
      fields: {
        biometrics: { field: 'biometrics', discoveredFactIds: ['fact:pikachu:size'], completed: true },
        behavior: { field: 'behavior', discoveredFactIds: ['fact:pikachu:playful'], completed: false },
        habitat: { field: 'habitat', discoveredFactIds: [], completed: false },
        exceptional: { field: 'exceptional', discoveredFactIds: [], completed: false },
      },
      additionalNoteIds: [],
    };
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.getByRole('button', { name: 'Abrir ficha de pikachu' }).click();

  const modal = page.getByRole('dialog', { name: 'pikachu' });
  await expect(modal.getByText('Investigación parcial', { exact: true })).toBeVisible();
  await expect(modal.getByText('CAMPO COMPLETO // 1 hallazgo verificado')).toBeVisible();
  await expect(modal.getByText('INVESTIGACIÓN PARCIAL // 1 observación')).toBeVisible();
  await expect(modal.getByText('AVISTAMIENTO REGISTRADO // faltan observaciones')).toHaveCount(2);
});

test('lista formas y apariencias permanentes con su primera procedencia', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.pokeDiscover.discoveredForms['pokemon-form:25:partner'] = {
      schemaVersion: 1,
      formId: 'pokemon-form:25:partner',
      speciesId: 25,
      discoveredAt: '2026-07-15T10:00:00.000Z',
      noteIds: ['note:comportamiento-jugueton'],
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
  });
  await page.getByRole('button', { name: 'Abrir ficha de pikachu' }).click();

  const modal = page.getByRole('dialog', { name: 'pikachu' });
  await expect(modal.getByRole('heading', { name: 'Formas y apariencias' })).toBeVisible();
  await expect(modal.getByText('3 descubiertas')).toBeVisible();
  await expect(modal.getByText('Forma habitual', { exact: true })).toBeVisible();
  await expect(modal.getByText('Forma Partner', { exact: true })).toBeVisible();
  await expect(modal.getByText('Surfista', { exact: true })).toBeVisible();
  await expect(modal.getByText('Mapa · Bosque verde')).toBeVisible();
  await expect(modal.getByText('Misión · Bahia en calma')).toBeVisible();
  await expect(modal.getByText('Nota · Domina las olas')).toBeVisible();
});

test('registrar a Mew no cuenta como avistarlo', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('mew');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Abrir ficha de mew' }).click();

  const modal = page.getByRole('dialog', { name: 'mew' });
  await expect(modal.getByText('No avistado', { exact: true })).toBeVisible();
  await expect(modal.getByText(/Team Rocket/)).toBeVisible();
  await expect(modal.getByText(/SERVIDOR SIN RESPUESTA/)).toBeVisible();
  await expect(modal.getByText(/posible leyenda/)).toBeVisible();
  await expect(modal.getByText('Registrar un nombre no equivale a un avistamiento. Su rastro continúa siendo una leyenda.')).toBeVisible();
});

test('arranca con el catálogo local cuando PokeAPI no está disponible', async ({ page }) => {
  await page.unroute('https://pokeapi.co/api/v2/**');
  await mockPokemonApiUnavailable(page);
  await page.evaluate(() => localStorage.removeItem('pokevoice-pokemon-catalog-v1'));
  await page.reload();

  await expect(page.locator('.pokemon-card')).toHaveCount(151);
  await expect(page.locator('.load-error')).toHaveCount(0);
  await expect(page.locator('.pokemon-card[data-id="25"]')).toBeVisible();
  await expect(page.locator('.pokemon-card[data-id="151"]')).toBeAttached();
  await expect(page.locator('.pokemon-card[data-id="152"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();
  await page.getByRole('button', { name: 'Mostrar Generación V', exact: true }).click();
  await expect(page.locator('.pokemon-card')).toHaveCount(156);
  const metrics = await page.evaluate(() => ({
    nodeCount: document.querySelectorAll('*').length,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    animatedBalls: [...document.querySelectorAll('.ball-assembly, .pokemon-ball-card')]
      .filter(ball => getComputedStyle(ball).animationName !== 'none').length,
    tiltingBalls: document.querySelectorAll('.ball-assembly.is-ball-tilting').length,
  }));
  expect(metrics.nodeCount).toBeLessThan(3000);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(metrics.animatedBalls).toBe(0);
  expect(metrics.tiltingBalls).toBe(0);
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

test('mantiene las Pokéballs quietas e inclina solo la que está bajo el cursor', async ({ page }) => {
  const firstCard = page.locator('.pokemon-card[data-id="1"]');
  const secondCard = page.locator('.pokemon-card[data-id="2"]');
  const firstAssembly = firstCard.locator('.ball-assembly');
  await expect(firstAssembly).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.pokemon-card[data-id="25"] .pikachu-electric-field')).toHaveCount(1);

  if (page.viewportSize().width >= 900) {
    const stageBox = await firstCard.locator('.pokemon-stage').boundingBox();
    const firstBox = await firstAssembly.boundingBox();
    const secondBox = await secondCard.locator('.ball-assembly').boundingBox();
    await page.mouse.move(stageBox.x + 2, stageBox.y + stageBox.height / 2);
    await expect(firstAssembly).not.toHaveClass(/is-ball-tilting/);
    await page.mouse.move(firstBox.x + firstBox.width * .85, firstBox.y + firstBox.height * .15);
    await expect(firstAssembly).toHaveClass(/is-ball-tilting/);
    await expect(firstAssembly).toHaveCSS('transition-duration', '0s');
    await expect.poll(() => firstAssembly.evaluate(element => (
      element.style.getPropertyValue('--ball-rotate-y') !== ''
    ))).toBe(true);
    const rotation = await firstAssembly.evaluate(element => ({
      x: Number.parseFloat(element.style.getPropertyValue('--ball-rotate-x')),
      y: Number.parseFloat(element.style.getPropertyValue('--ball-rotate-y')),
    }));
    expect(Math.abs(rotation.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(rotation.y)).toBeLessThanOrEqual(14);
    expect(Math.abs(rotation.x)).toBeGreaterThan(5);
    expect(Math.abs(rotation.y)).toBeGreaterThan(7);

    await page.mouse.move(firstBox.x + firstBox.width * .15, firstBox.y + firstBox.height * .85, { steps: 30 });
    await page.mouse.move(stageBox.x + 2, stageBox.y + stageBox.height / 2);
    await expect(firstAssembly).not.toHaveClass(/is-ball-tilting/);
    await expect.poll(() => firstAssembly.evaluate(element => (
      element.style.getPropertyValue('--ball-rotate-x') + element.style.getPropertyValue('--ball-rotate-y')
    ))).toBe('');

    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
    await expect(secondCard.locator('.ball-assembly')).toHaveClass(/is-ball-tilting/);
    await expect(firstAssembly).not.toHaveClass(/is-ball-tilting/);

    await page.mouse.move(stageBox.x + 2, stageBox.y + stageBox.height / 2);
    await expect(secondCard.locator('.ball-assembly')).not.toHaveClass(/is-ball-tilting/);
    await expect(secondCard.locator('.ball-assembly')).toHaveCSS('transition-duration', '0.18s');
  }

  await firstCard.getByRole('button', { name: 'Abrir ficha de #0001' }).click();
  await expect(page.getByRole('dialog', { name: 'DATOS CLASIFICADOS' })).toBeVisible();
});

test('aísla la sombra circular del contenedor animado de Pikachu', async ({ page }) => {
  const pikachuCard = page.locator('.pokemon-card[data-id="25"]');
  const animatedBall = pikachuCard.locator('.pokemon-ball-card');
  const shell = pikachuCard.locator('.ball-assembly');

  await expect(animatedBall).toHaveCSS('filter', 'none');
  await expect(pikachuCard.locator('[data-pikachu-bolt]')).toHaveCount(7);
  await expect(pikachuCard.locator('.pikachu-electricity path')).toHaveCount(28);
  await expect.poll(() => animatedBall.evaluate(node => node.classList.contains('pikachu-burst'))).toBe(true);
  await expect(pikachuCard.locator('.ball-motion')).toHaveCSS('animation-name', 'pikachuStruggle');
  await expect(pikachuCard.locator('.pikachu-electricity')).toHaveCSS('filter', /pikachu-electric-glow/);
  await expect(shell).toHaveCSS('box-shadow', /rgba\(0, 0, 0, 0\.4\)/);
  expect(await page.evaluate(() => {
    window.scrollTo({ left: 100, top: window.scrollY });
    return window.scrollX;
  })).toBe(0);
});

test('retira la sombra cerrada al separar las mitades de una Pokéball descubierta', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('squirtle');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Abrir ficha de squirtle' })).toBeVisible();

  const card = page.locator('.pokemon-card[data-id="7"]');
  await expect(card.locator('.ball-assembly')).toHaveCSS('box-shadow', 'none');
  await expect(card.locator('.ball-shell--bottom')).toHaveCSS('clip-path', 'inset(50% 0px 0px)');
});

test('una Pokéball descubierta conserva el volumen pero deja de flotar', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');

  const card = page.locator('.pokemon-card[data-id="25"]');
  await expect(card.locator('.ball-assembly')).toHaveCount(1);
  await expect(card.locator('.ball-assembly')).toHaveCSS('animation-name', 'none');
  await expect(card.locator('.pikachu-electric-field')).toHaveCount(0);
  await expect(card.locator('.pokemon-art')).toBeVisible();
});

test('respeta movimiento reducido sin perder el volumen estático', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const card = page.locator('.pokemon-card[data-id="1"]');
  const assembly = card.locator('.ball-assembly');
  await expect(assembly).toHaveCSS('animation-name', 'none');
  await expect(assembly).toHaveCSS('translate', 'none');
  await expect(page.locator('.pokemon-card[data-id="25"] .pokemon-ball-card')).not.toHaveClass(/pikachu-burst/);
  await expect(page.locator('.pokemon-card[data-id="25"] .pikachu-electricity .is-live')).toHaveCount(0);

  if (page.viewportSize().width >= 900) {
    const box = await assembly.boundingBox();
    await page.mouse.move(box.x + box.width - 2, box.y + 2);
    await expect(assembly).not.toHaveClass(/is-ball-tilting/);
  }
});

test('adapta la navegación al lateral en escritorio y abajo en móvil', async ({ page }) => {
  const metrics = await page.locator('#dock').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  await expect(page.locator('#dock').getByPlaceholder('Escribe un nombre y pulsa Enter.')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Descubrimiento por voz o texto', exact: true })
    .getByPlaceholder('Escribe un nombre y pulsa Enter.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Descubrimiento por voz o texto', exact: true }))
    .toHaveCSS('position', 'fixed');
  const searchMetrics = await page.evaluate(() => {
    const input = document.querySelector('#txtGuess');
    const firstBall = document.querySelector('.pokemon-ball-card');
    const inputRect = input.getBoundingClientRect();
    const ballRect = firstBall.getBoundingClientRect();
    return {
      placeholderColor: getComputedStyle(input, '::placeholder').color,
      gapToFirstBall: Math.round(ballRect.top - inputRect.bottom),
    };
  });
  expect(searchMetrics.placeholderColor).toBe('rgba(255, 255, 255, 0.72)');
  expect(searchMetrics.gapToFirstBall).toBeGreaterThanOrEqual(50);

  if (metrics.viewportWidth >= 900) {
    expect(metrics).toMatchObject({ left: 0, top: 0, bottom: metrics.viewportHeight, width: 112 });
  } else {
    expect(metrics.left).toBe(0);
    expect(metrics.right).toBe(metrics.viewportWidth);
    expect(metrics.bottom).toBe(metrics.viewportHeight);
    expect(metrics.height).toBeGreaterThanOrEqual(74);
  }
});

test('recupera los descubrimientos al recargar', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('eevee');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Abrir ficha de eevee' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Abrir ficha de eevee' })).toBeVisible();
  await expect(page.getByRole('button', { name: /1 descubiertos/ })).toBeVisible();
});

test('muestra una sola generación y recuerda la selección', async ({ page }) => {
  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();
  await page.getByRole('button', { name: 'Mostrar Generación II', exact: true }).click();

  await expect(page.locator('.pokemon-card')).toHaveCount(1);
  await expect(page.locator('.pokemon-card[data-id="152"]')).toBeVisible();
  await expect(page.locator('.pokemon-card[data-id="25"]')).toHaveCount(0);

  await page.reload();

  await expect(page.locator('.pokemon-card[data-id="152"]')).toBeVisible();
  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();
  await expect(page.getByRole('heading', { name: 'Generación II' })).toBeVisible();
});

test('cambia de región desde el selector rápido de la cabecera', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'El selector regional se muestra solo en pantallas grandes.');
  const region = page.getByRole('button', { name: 'Kanto' });
  await region.click();
  const menu = page.getByRole('menu', { name: 'Cambiar región' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitemradio')).toHaveCount(9);
  await menu.getByRole('menuitemradio', { name: 'Johto, generación 2' }).click();

  await expect(page.locator('.pokemon-card[data-id="152"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Johto' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).preferences.activeGenerationId
  ))).toBe(2);
});

test('la búsqueda global cambia a la generación del resultado', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('sprigatito');
  await input.press('Enter');

  await expect(page.getByRole('button', { name: 'Abrir ficha de sprigatito' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).preferences.activeGenerationId
  ))).toBe(9);
  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();
  await expect(page.getByRole('heading', { name: 'Generación IX' })).toBeVisible();
});

test('reúne generación, estadísticas y ajustes en un único drawer', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Controles de Pokédex' });
  const drawer = page.locator('#pokedex-controls-drawer');
  const idleAppearance = await trigger.evaluate(element => {
    const style = getComputedStyle(element);
    const icon = element.querySelector('.nav-action-icon');
    return { borderColor: style.borderColor, color: style.color, iconSize: getComputedStyle(icon).fontSize };
  });

  await trigger.click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  const generations = drawer.getByRole('navigation', { name: 'Generaciones de la Pokédex' });
  await expect(generations).toBeVisible();
  await expect(generations.getByRole('button')).toHaveCount(10);
  await expect(generations.getByRole('button', { name: 'Generación X aún no disponible' })).toBeDisabled();
  const progress = drawer.getByLabel('Progreso de la Pokédex');
  await expect(progress).toBeVisible();
  await expect(progress.getByRole('progressbar')).toHaveCount(2);
  await expect(progress.getByText('0%', { exact: true })).toHaveCount(2);
  const sizeSlider = drawer.getByLabel('Tamaño de Pokéballs');
  await expect(sizeSlider).toBeVisible();
  const sizeControl = drawer.locator('.size-control');
  await sizeControl.evaluate(element => { element.style.width = '90px'; });
  expect(await sizeControl.evaluate(element => {
    const controlBounds = element.getBoundingClientRect();
    const icons = [...element.querySelectorAll('.size-icon')];
    return element.scrollWidth <= element.clientWidth
      && icons.every(icon => {
        const bounds = icon.getBoundingClientRect();
        return bounds.left >= controlBounds.left - 1 && bounds.right <= controlBounds.right + 1;
      });
  })).toBe(true);
  await sizeControl.evaluate(element => { element.style.width = ''; });
  await sizeSlider.fill('32');
  expect(await page.locator('.pokemon-card[data-id="1"] .ball-assembly').evaluate(element => (
    Number.parseFloat(getComputedStyle(element, '::after').borderTopWidth)
  ))).toBeGreaterThanOrEqual(2);
  expect(await page.locator('.pokemon-card[data-id="1"] .ball-shell--top').evaluate(element => (
    Number.parseFloat(getComputedStyle(element).insetBlockStart)
  ))).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.secondary-menu')).toHaveCount(0);
  const activeAppearance = await trigger.evaluate(element => {
    const style = getComputedStyle(element);
    const icon = element.querySelector('.nav-action-icon');
    return { borderColor: style.borderColor, color: style.color, iconSize: getComputedStyle(icon).fontSize };
  });
  expect(activeAppearance).toEqual(idleAppearance);
  const layout = await page.evaluate(() => {
    const drawerRect = document.querySelector('#pokedex-controls-drawer').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.generation-pagination button')].map(button => button.getBoundingClientRect());
    const styleToggleRect = document.querySelector('.image-style-control').getBoundingClientRect();
    const dangerRect = document.querySelector('.drawer-section--danger').getBoundingClientRect();
    return {
      drawerWidth: Math.round(drawerRect.width),
      firstRowTop: Math.round(buttons[0].top),
      firstRowEndTop: Math.round(buttons[4].top),
      secondRowTop: Math.round(buttons[5].top),
      secondRowEndTop: Math.round(buttons[9].top),
      styleToggleWidth: Math.round(styleToggleRect.width),
      dangerBottomGap: Math.round(drawerRect.bottom - dangerRect.bottom),
    };
  });
  expect(layout.drawerWidth).toBeGreaterThanOrEqual(350);
  expect(layout.drawerWidth).toBeLessThanOrEqual(365);
  expect(layout.firstRowEndTop).toBe(layout.firstRowTop);
  expect(layout.secondRowEndTop).toBe(layout.secondRowTop);
  expect(layout.secondRowTop).toBeGreaterThan(layout.firstRowTop);
  expect(layout.styleToggleWidth).toBeLessThan(layout.drawerWidth - 20);
  expect(layout.dangerBottomGap).toBeLessThanOrEqual(16);

  await trigger.click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
});

test('representa el progreso de generación y global con barras y porcentajes', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();

  const generationProgress = page.getByRole('progressbar', { name: 'Progreso de esta generación' });
  const globalProgress = page.getByRole('progressbar', { name: 'Progreso global de la Pokédex' });
  await expect(generationProgress).toHaveAttribute('value', '1');
  await expect(generationProgress).toHaveAttribute('max', '8');
  await expect(globalProgress).toHaveAttribute('value', '1');
  await expect(globalProgress).toHaveAttribute('max', '10');
  await expect(page.getByText('13%', { exact: true })).toBeVisible();
  await expect(page.getByText('10%', { exact: true })).toBeVisible();
});

test('cierra el drawer al pulsar fuera e inicia el Coleccionista sin confirmación', async ({ page }) => {
  await page.getByRole('button', { name: 'Modos' }).click();
  await expect(page.locator('#modes-drawer')).toHaveAttribute('aria-hidden', 'false');
  const viewport = page.viewportSize();
  await page.locator('.drawer-dismiss-layer').click({
    position: { x: viewport.width - 2, y: Math.floor(viewport.height / 2) },
  });
  await expect(page.locator('#modes-drawer')).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: 'Modos' }).click();
  const collector = page.locator('[data-mode-id="timed-collector"]');
  await expect(collector).toHaveAttribute('data-run-policy', 'isolatedPokedex');
  await expect(collector).toContainText('Coleccionista de logros');
  await expect(collector).toContainText('Tienes 2:00 minutos para obtener el máximo número de logros descubriendo Pokémon.');

  await collector.getByRole('button', { name: 'Empezar' }).click();

  const countdown = page.getByRole('status', { name: 'Cuenta atrás del Coleccionista' });
  await expect(page.locator('#dock')).toHaveCount(0);
  await expect(countdown).toHaveText('3');
  await expect(countdown).toHaveText('2');
  await expect(countdown).toHaveText('1');
  await expect(countdown).toHaveText('¡Ahora!');
  await expect(page.locator('.timer-chip')).toContainText('2:00');
  await expect(page.locator('#dock')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Finalizar Coleccionista' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('__pv_timer__'))).not.toBeNull();

  await page.getByRole('button', { name: 'Finalizar Coleccionista' }).click();
  await expect(page.getByRole('dialog', { name: 'Fin del contrarreloj' })).toBeVisible();
  await expect(page.locator('#dock')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).activeModeSession ?? null
  ))).toBeNull();
});

test('el Coleccionista oculta la Pokédex original dentro de su run temporal', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.registeredSpeciesIds.includes(25)
  ))).toBe(true);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun);

  await page.getByRole('button', { name: 'Modos' }).click();
  await page.locator('[data-mode-id="timed-collector"]').getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('button', { name: 'Finalizar Coleccionista' })).toBeVisible();

  await expect(page.locator('#modes-drawer')).toHaveAttribute('aria-hidden', 'true');
  const after = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return { run: save.pokedexRun, activeModeSession: save.activeModeSession ?? null };
  });
  expect(after.run.runId).not.toBe(before.runId);
  expect(after.run.registeredSpeciesIds).toEqual([]);
  expect(after.activeModeSession.suspendedPokedexRun).toEqual(before);
  await expect(page.getByRole('button', { name: 'Abrir ficha de #0025' })).toBeVisible();
});

test('mantiene una racha infinita, consume comodines de sesión y termina al fallar', async ({ page }) => {
  const before = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      runId: save.pokedexRun.runId,
      discoveryPoints: save.pokeDiscover.discoveryPoints,
      researchBySpecies: save.pokeDiscover.researchBySpecies,
    };
  });

  await page.getByRole('button', { name: 'Modos' }).click();
  const modeCard = page.locator('[data-mode-id="whos-that-pokemon"]');
  await expect(modeCard).toHaveAttribute('data-run-policy', 'preserve');
  await modeCard.getByRole('button', { name: 'Empezar' }).click();

  const mode = page.locator('.whos-mode');
  await expect(mode).toBeVisible();
  await expect(mode).toContainText('Racha: 0');
  await expect(mode.getByRole('button', { name: 'Salir del modo' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.runId
  ))).toBe(before.runId);

  await mode.getByRole('button', { name: 'Pista de texto · 5' }).click();
  await expect(mode.locator('.whos-mode__hints p')).toHaveCount(1);
  await expect(mode.getByRole('button', { name: 'Pista de texto · 4' })).toBeVisible();
  await mode.getByRole('button', { name: 'Revelar tipos · 3' }).click();
  await expect(mode.locator('.whos-mode__types')).toBeVisible();
  await expect(mode.getByRole('button', { name: 'Revelar tipos · 2' })).toBeDisabled();
  await expect(mode.getByRole('button', { name: 'Escuchar grito' })).toBeVisible();
  await expect(mode.getByRole('button', { name: 'Responder por voz' })).toBeVisible();
  const firstTargetId = Number(await mode.locator('.whos-mode__portrait').getAttribute('data-target-id'));
  const firstTarget = pokemonCatalogFixture.results.find(entry => entry.url.endsWith(`/pokemon/${firstTargetId}/`));
  expect(firstTarget).toBeTruthy();
  await mode.getByRole('textbox', { name: 'Respuesta Pokémon' }).fill(firstTarget.name);
  await mode.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(mode).toContainText('¡Correcto!');
  await expect(mode).toContainText('Racha: 1');
  await expect.poll(() => page.evaluate(id => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokedexRun.registeredSpeciesIds.includes(id)
  ), firstTargetId)).toBe(true);

  await mode.getByRole('button', { name: 'Siguiente Pokémon' }).click();
  await expect(mode.getByRole('button', { name: 'Pista de texto · 4' })).toBeVisible();
  await expect(mode.getByRole('button', { name: 'Revelar tipos · 2' })).toBeEnabled();
  await expect(mode.locator('.whos-mode__hints p')).toHaveCount(0);
  await expect(mode.locator('.whos-mode__types')).toHaveCount(0);
  await mode.getByRole('button', { name: 'Rendirse' }).click();
  await expect(mode).toContainText('No era ese Pokémon.');
  await mode.getByRole('button', { name: 'Ver resultado' }).click();

  await expect(mode).toContainText('Racha final');
  await expect(mode.locator('.whos-mode__results > strong')).toHaveText('1');
  await expect(mode).toContainText('¡Nuevo récord personal!');
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      progress: save.pokeDiscover.modeProgress['whos-that-pokemon'],
      achievement: save.pokeDiscover.achievements['whos-that-pokemon-complete'],
      discoveryPoints: save.pokeDiscover.discoveryPoints,
      researchBySpecies: save.pokeDiscover.researchBySpecies,
    };
  })).toMatchObject({
    progress: { completed: true, completionCount: 1, bestScore: 1 },
    achievement: { originModeId: 'whos-that-pokemon' },
    discoveryPoints: before.discoveryPoints,
    researchBySpecies: before.researchBySpecies,
  });

  await mode.getByRole('button', { name: 'Volver a la Pokédex' }).click();
  await page.getByRole('button', { name: 'Modos' }).click();
  await expect(page.locator('[data-mode-id="whos-that-pokemon"]')).toContainText('Mejor racha: 1 · 1 partida');
});

test('completa un reto temático sin reiniciar la run ni duplicar metaprogresión', async ({ page }) => {
  const before = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      runId: save.pokedexRun.runId,
      discoveryPoints: save.pokeDiscover.discoveryPoints,
      researchBySpecies: save.pokeDiscover.researchBySpecies,
    };
  });

  await page.getByRole('button', { name: 'Modos' }).click();
  const modeCard = page.locator('[data-mode-id="themed-challenges"]');
  await expect(modeCard).toHaveAttribute('data-run-policy', 'preserve');
  await modeCard.getByRole('button', { name: 'Empezar' }).click();

  const mode = page.locator('.themed-mode');
  await expect(mode).toBeVisible();
  await expect(mode.locator('.themed-challenge-card')).toHaveCount(3);
  await mode.getByRole('button', { name: /La caja de Ash está a reventar/i }).click();
  await expect(mode.getByLabel('Progreso del reto')).toHaveText('0/3');
  await expect(mode.getByRole('button', { name: 'Responder al reto por voz' })).toBeVisible();

  const answer = mode.getByRole('textbox', { name: 'Respuesta del reto temático' });
  await answer.fill('mew');
  await mode.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.locator('.toast')).toContainText('no pertenece a este reto');
  await expect(mode.getByLabel('Progreso del reto')).toHaveText('0/3');

  for (const [name, progress] of [['bulbasaur', '1/3'], ['charmander', '2/3'], ['squirtle', '3/3']]) {
    await answer.fill(name);
    await mode.getByRole('button', { name: 'Comprobar' }).click();
    await expect(mode.getByLabel('Progreso del reto')).toHaveText(progress);
  }

  await expect(mode).toContainText('¡Investigación completada!');
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      runId: save.pokedexRun.runId,
      registered: save.pokedexRun.registeredSpeciesIds,
      progress: save.pokeDiscover.modeProgress['themed-challenges'],
      achievement: save.pokeDiscover.achievements['themed-challenge-complete'],
      discoveryPoints: save.pokeDiscover.discoveryPoints,
      researchBySpecies: save.pokeDiscover.researchBySpecies,
    };
  })).toMatchObject({
    runId: before.runId,
    registered: [1, 4, 7],
    progress: {
      completed: true,
      completionCount: 1,
      completedChallengeIds: ['family-ash-owned-pokemon'],
    },
    achievement: { originModeId: 'themed-challenges' },
    discoveryPoints: before.discoveryPoints,
    researchBySpecies: before.researchBySpecies,
  });

  await mode.getByRole('button', { name: 'Elegir otro reto' }).click();
  await expect(mode.getByRole('button', { name: /La caja de Ash está a reventar/i })).toContainText('✓ Completado');
  await mode.getByRole('button', { name: 'Salir de Trivia Pokémon' }).click();
  await page.getByRole('button', { name: 'Modos' }).click();
  await expect(page.locator('[data-mode-id="themed-challenges"]')).toContainText('1 reto superado · 1 partida');
});

test('aprueba una sola vez el examen diario y conserva una racha persistente', async ({ page }) => {
  const before = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      runId: save.pokedexRun.runId,
      discoveryPoints: save.pokeDiscover.discoveryPoints,
      researchBySpecies: save.pokeDiscover.researchBySpecies,
    };
  });

  await page.getByRole('button', { name: 'Modos' }).click();
  const modeCard = page.locator('[data-mode-id="daily-trivia"]');
  await expect(modeCard).toHaveAttribute('data-run-policy', 'preserve');
  await modeCard.getByRole('button', { name: 'Empezar' }).click();

  const mode = page.locator('.themed-mode[aria-label="Examen diario"]');
  await expect(mode).toBeVisible();
  const challengeId = await mode.locator('.themed-mode__game').getAttribute('data-challenge-id');
  const answersByChallenge = {
    'generation:kanto-icons': ['bulbasaur', 'charmander', 'squirtle'],
    'type:deep-roots': ['bulbasaur', 'ivysaur', 'venusaur'],
    'family-ash-owned-pokemon': ['bulbasaur', 'charmander', 'squirtle'],
  };
  const answers = answersByChallenge[challengeId];
  expect(answers).toBeTruthy();
  const answer = mode.getByRole('textbox', { name: 'Respuesta del reto temático' });
  for (const name of answers) {
    await answer.fill(name);
    await mode.getByRole('button', { name: 'Comprobar' }).click();
  }

  await expect(mode).toContainText('¡Examen diario aprobado!');
  await expect(mode).toContainText('Racha actual: 1');
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    return {
      runId: save.pokedexRun.runId,
      progress: save.pokeDiscover.modeProgress['daily-trivia'],
      achievement: save.pokeDiscover.achievements['daily-trivia-complete'],
      discoveryPoints: save.pokeDiscover.discoveryPoints,
      researchBySpecies: save.pokeDiscover.researchBySpecies,
    };
  })).toMatchObject({
    runId: before.runId,
    progress: { completionCount: 1, dailyStreak: 1, bestDailyStreak: 1 },
    achievement: { originModeId: 'daily-trivia' },
    discoveryPoints: before.discoveryPoints,
    researchBySpecies: before.researchBySpecies,
  });

  await mode.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Modos' }).click();
  await expect(modeCard).toContainText('Racha: 1 · Mejor: 1 · 1 partida');
  await modeCard.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.locator('.toast')).toContainText('Ya has aprobado el examen de hoy');
  await expect(mode).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover.modeProgress['daily-trivia'].completionCount
  ))).toBe(1);
});

test('recupera el contrarreloj y su run al recargar', async ({ page }) => {
  await page.getByRole('button', { name: 'Modos' }).click();
  await page.locator('[data-mode-id="timed-collector"]').getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('button', { name: 'Finalizar Coleccionista' })).toBeVisible();
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
  await page.locator('[data-mode-id="timed-collector"]').getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('button', { name: 'Finalizar Coleccionista' })).toBeVisible();
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

test('cierra el contrarreloj con estadísticas completas y guarda su récord', async ({ page }) => {
  await page.clock.install();
  const normalInput = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await normalInput.fill('pikachu');
  await normalInput.press('Enter');
  await expect(page.getByRole('button', { name: 'Abrir ficha de pikachu' })).toBeVisible();
  await page.getByRole('button', { name: 'Modos' }).click();
  await page.locator('[data-mode-id="timed-collector"]').getByRole('button', { name: 'Empezar' }).click();
  await page.clock.fastForward('00:04');
  await expect(page.getByRole('button', { name: 'Finalizar Coleccionista' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir ficha de #0025' })).toBeVisible();

  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('ivysaur');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Abrir ficha de ivysaur' })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('ivysaur descubierto');
  await input.fill('esto no es un pokemon');
  await input.press('Enter');
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).activeModeSession.failures
  ))).toBe(1);

  await page.clock.fastForward('02:01');

  const results = page.getByRole('dialog', { name: 'Fin del contrarreloj' });
  await expect(results).toBeVisible();
  await expect(results).toContainText('Descubiertos1');
  await expect(results).toContainText('Precisión50%');
  await expect(results).toContainText('Mejor racha×1');
  await expect(results).toContainText('Fallos1');
  await expect(results).toContainText('2 intentos');
  await expect(results).toContainText('A contrarreloj');
  await expect(page.getByRole('button', { name: 'Abrir ficha de pikachu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir ficha de #0002' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).pokeDiscover.modeProgress['timed-collector']
  ))).toMatchObject({ completed: true, completionCount: 1, bestScore: 2 });
  await results.getByRole('button', { name: 'Aceptar' }).click();
  await page.getByRole('button', { name: 'Modos' }).click();
  await expect(page.locator('[data-mode-id="timed-collector"]')).toContainText('Récord: 2 logros · 1 partida');
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
  const achievementDrawerPosition = await page.locator('#acv-drawer').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { rightGap: Math.round(window.innerWidth - rect.right) };
  });
  expect(achievementDrawerPosition.rightGap).toBeLessThanOrEqual(12);
  await page.getByRole('button', { name: 'Logros' }).click();
  await expect(page.locator('#acv-drawer')).toHaveAttribute('aria-hidden', 'true');
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

test('el contrarreloj puntúa logros permanentes una vez y los recupera al recargar', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('pokevoice-achievements-v1', JSON.stringify([
      { id: 'first-blood', date: 100 },
      { id: 'classic-start-pikachu', date: 200 },
    ]));
  });
  await page.reload();

  await page.getByRole('button', { name: 'Modos' }).click();
  await page.locator('[data-mode-id="timed-collector"]').getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('button', { name: 'Finalizar Coleccionista' })).toBeVisible();
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('pikachu');
  await input.press('Enter');

  await expect(page.locator('.acv-toast').filter({ hasText: 'Logro del reto' })).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-save-v1')).activeModeSession.satisfiedAchievementIds
  ))).toEqual(expect.arrayContaining(['first-blood', 'classic-start-pikachu']));
  expect(await page.evaluate(() => (
    JSON.parse(localStorage.getItem('pokevoice-achievements-v1')).length
  ))).toBe(2);

  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pokevoice-save-v1'));
    save.activeModeSession.startedAt = new Date(Date.now() - 121_000).toISOString();
    localStorage.setItem('pokevoice-save-v1', JSON.stringify(save));
  });
  await page.reload();

  const results = page.getByRole('dialog', { name: 'Fin del contrarreloj' });
  await expect(results).toBeVisible();
  await expect(results).toContainText('Logros3');
  await expect(results).toContainText('Primer paso');
  await expect(results).toContainText('Un inicio clásico');
  await expect(results).toContainText('A contrarreloj');
  await expect(results).toContainText('Precisión100%');
  await expect(results).toContainText('Mejor racha×1');
  await expect(results).toContainText('1 intento');
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
  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();
  await page.getByRole('button', { name: 'Reiniciar progreso', exact: true }).click();

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

  await page.getByRole('button', { name: 'Controles de Pokédex' }).click();
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
