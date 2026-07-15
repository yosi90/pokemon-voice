import { expect, test } from '@playwright/test';
import {
  mockPokemonApi,
  mockPokemonApiUnavailable,
  generationOneFixtureCount,
  pokemonCatalogFixture,
} from '../fixtures/pokemonCatalog.js';

test.beforeEach(async ({ page }) => {
  await mockPokemonApi(page);
  await page.goto('/');
  const voiceModal = page.locator('#voice-support-modal');
  if (await voiceModal.isVisible()) {
    await voiceModal.getByRole('button', { name: 'Cerrar' }).click();
  }
  await expect(page.locator('.pokemon-card')).toHaveCount(generationOneFixtureCount);
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
  }));
  expect(metrics.nodeCount).toBeLessThan(3000);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
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
  await expect(page.getByRole('button', { name: 'eevee, reproducir sonido' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'eevee, reproducir sonido' })).toBeVisible();
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

test('la búsqueda global cambia a la generación del resultado', async ({ page }) => {
  const input = page.getByPlaceholder('Escribe un nombre y pulsa Enter.');
  await input.fill('sprigatito');
  await input.press('Enter');

  await expect(page.getByRole('button', { name: 'sprigatito, reproducir sonido' })).toBeVisible();
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
  await expect(drawer.getByLabel('Tamaño de Pokéballs')).toBeVisible();
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
