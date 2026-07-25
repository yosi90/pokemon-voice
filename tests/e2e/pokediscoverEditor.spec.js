import { expect, test } from '@playwright/test';

async function openTegueste(page) {
  await page.goto('/tools/pokediscover-editor/');
  await page.getByTestId('adventure-folder').setInputFiles('public/assets/adventure/maps/tegueste-forest');
  await expect(page.getByText(/4 habitaciones abiertas/)).toBeVisible({ timeout: 20_000 });
}

test.describe('configurador de escritorio', () => {
  test.skip(({ viewport }) => viewport && viewport.width < 1280, 'La edición sólo se ofrece en escritorio.');

  test('abre la carpeta inmediatamente y registra todos sus TMJ', async ({ page }) => {
    await openTegueste(page);

    const explorer = page.getByRole('complementary', { name: 'Explorador de habitaciones' });
    await expect(explorer.locator('.editor-room-explorer__list > button')).toHaveCount(4);
    await expect(explorer).toContainText('01-05');
    await expect(explorer).toContainText('02-05');
    await expect(explorer).toContainText('04-05');
    await expect(explorer).toContainText('05-05');
    await expect(explorer).not.toContainText('02-04');
    await expect(page.getByRole('button', { name: 'Abrir proyecto' })).toHaveCount(0);
    await expect(page.getByTestId('pokediscover-editor-runtime')).toHaveAttribute('data-runtime', 'ready', { timeout: 20_000 });

    const documentMetrics = await page.evaluate(() => ({
      body: document.body.scrollHeight,
      viewport: window.innerHeight,
      overflow: getComputedStyle(document.body).overflow,
    }));
    expect(documentMetrics.body).toBeLessThanOrEqual(documentMetrics.viewport);
    expect(documentMetrics.overflow).toBe('hidden');
  });

  test('mantiene estable el lienzo y permite diseñar habitaciones incompletas', async ({ page }) => {
    await openTegueste(page);
    const viewport = page.locator('.editor-map-viewport');
    const initial = await viewport.boundingBox();

    await page.locator('.editor-room-explorer__list > button').filter({ hasText: '05-05' }).click();
    await expect(page.getByTestId('pokediscover-editor-runtime')).toHaveAttribute('data-runtime', 'ready', { timeout: 20_000 });
    const changed = await viewport.boundingBox();
    expect(changed).toEqual(initial);
    await expect(viewport).toHaveCSS('transition-duration', '0s');

    await page.getByRole('button', { name: 'Ancla', exact: true }).click();
    const overlay = page.locator('.editor-geometry-overlay');
    await overlay.click({ position: { x: 160, y: 128 } });
    await expect(page.getByLabel('Objeto seleccionado')).toContainText('anchor:nuevo');
    await expect(page.getByText(/archivo.*pendiente/)).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(page.getByLabel('Objeto seleccionado')).toHaveCount(0);
  });

  test('dibuja el .world en un único canvas y conserva los bordes contiguos', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', { name: 'Ver mapa completo' }).click();

    const overview = page.getByRole('region', { name: 'Vista completa de la aventura' });
    await expect(overview.getByTestId('pokediscover-world-canvas')).toHaveCount(1);
    await expect(page.getByTestId('pokediscover-editor-runtime')).toHaveCount(0);
    const positions = await overview.locator('.editor-world-room').evaluateAll(elements => Object.fromEntries(elements.map(element => {
      const label = element.textContent.trim();
      return [label, {
        left: Number.parseFloat(element.style.left),
        top: Number.parseFloat(element.style.top),
        width: Number.parseFloat(element.style.width),
        height: Number.parseFloat(element.style.height),
      }];
    })));
    expect(positions['01-05'].left).toBe(480);
    expect(positions['01-05'].top + positions['01-05'].height).toBe(positions['02-05'].top);
    expect(positions['02-05'].top + positions['02-05'].height).toBe(positions['05-05'].top);
    expect(positions['04-05'].left + positions['04-05'].width).toBe(positions['05-05'].left);
  });

  test('abre utilidades en ventanas y deja el lenguaje técnico en detalles avanzados', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', { name: 'Contenido' }).click();
    await page.getByRole('menuitem', { name: 'Colocaciones' }).click();
    const placements = page.getByRole('region', { name: 'Colocaciones' });
    await expect(placements).toBeVisible();
    await expect(placements.getByText('Colocación de contenido')).toBeVisible();
    await expect(placements.getByText(/Tamaño visual/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Entradas del jugador' }).click();
    const entries = page.getByRole('region', { name: 'Entradas del jugador' });
    await expect(entries).toContainText('Llegada para ayudar al profesor');
    await expect(entries).toContainText('Expedición libre');
    await expect(entries.getByText('entry-point:tegueste-forest:camphor-rescue')).toBeHidden();
    await entries.getByText('Detalles avanzados').click();
    await expect(entries).toContainText('entry-point:tegueste-forest:camphor-rescue');
  });

  test('coloca un Pokémon al 150% con ruta y lo reproduce en modo Probar', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', { name: 'Contenido' }).click();
    await page.getByRole('menuitem', { name: 'Colocaciones' }).click();
    const placements = page.getByRole('region', { name: 'Colocaciones' });
    await placements.getByRole('slider', { name: /Tamaño visual/ }).first().fill('150');
    await placements.getByRole('combobox', { name: 'Movimiento' }).selectOption('path');
    await expect(placements.getByRole('combobox', { name: 'Ruta' })).not.toHaveValue('');
    await placements.getByRole('button', { name: 'Confirmar colocación' }).click();
    await expect(placements.getByText(/Colocación seleccionada/)).toBeVisible();
    await expect(placements.getByRole('slider', { name: /Tamaño visual/ }).last()).toHaveValue('150');

    await page.getByRole('button', { name: 'Probar', exact: true }).click();
    const runtime = page.getByTestId('pokediscover-editor-runtime');
    await expect(runtime).toHaveAttribute('data-runtime', 'ready');
    await expect(runtime).toHaveAttribute('data-ambient-sequence-count', /[1-9]\d*/);
  });

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
    { width: 3440, height: 1440 },
  ]) {
    test(`no crea scroll de documento a ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openTegueste(page);
      await page.getByRole('button', { name: 'Herramientas' }).click();
      await page.getByRole('menuitem', { name: 'Catálogo' }).click();
      const utility = page.getByRole('region', { name: 'Catálogo', exact: true });
      await expect(utility).toBeVisible();
      const result = await page.evaluate(() => {
        const utility = document.querySelector('.editor-window').getBoundingClientRect();
        return {
          bodyHeight: document.body.scrollHeight,
          viewportHeight: window.innerHeight,
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
          windowInside: utility.left >= 0 && utility.top >= 0
            && utility.right <= window.innerWidth && utility.bottom <= window.innerHeight,
        };
      });
      expect(result.bodyHeight).toBeLessThanOrEqual(result.viewportHeight);
      expect(result.bodyWidth).toBeLessThanOrEqual(result.viewportWidth);
      expect(result.windowInside).toBe(true);
    });
  }

  test('inicia el asistente cuando la carpeta sólo contiene un TMJ', async ({ page }) => {
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder').setInputFiles('tests/fixtures/pokediscover-no-sidecar');
    const dialog = page.getByRole('dialog', { name: 'Crear proyecto del mapa' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Nombre del mapa' }).fill('Mapa de prueba');
    await dialog.getByRole('textbox', { name: 'Identificador' }).fill('map:test:authoring');
    await dialog.getByRole('button', { name: 'Crear y abrir' }).click();
    await expect(page.getByText(/1 habitaciones abiertas/)).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Explorador de habitaciones' })).toContainText('room-01');
  });
});

test('en móvil sólo muestra el aviso de herramienta de escritorio', async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width >= 1280, 'Comprobación específica del proyecto móvil.');
  await page.goto('/tools/pokediscover-editor/');
  await expect(page.getByRole('alert')).toContainText('Configurador de escritorio');
  await expect(page.getByText('Esta herramienta necesita una pantalla de al menos 1280×720.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir carpeta' })).toHaveCount(0);
});
