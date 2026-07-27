import { expect, test } from '@playwright/test';

async function openTegueste(page) {
  await page.goto('/tools/pokediscover-editor/');
  await page.getByTestId('adventure-folder').setInputFiles('public/assets/adventure/maps/tegueste-forest');
  await expect(page.getByText(/4 habitaciones abiertas/)).toBeVisible({ timeout: 20_000 });
}

test.describe('configurador de escritorio', () => {
  test.setTimeout(60_000);
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

  test('recupera durante 24 horas la última carpeta tras recargar', async ({ page }) => {
    await openTegueste(page);
    await expect.poll(() => page.evaluate(() => new Promise(resolve => {
      const request = indexedDB.open('pokediscover-editor', 1);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('recent-folders', 'readonly');
        const stored = transaction.objectStore('recent-folders').get('last-directory-snapshot-v2');
        stored.onsuccess = () => resolve(stored.result?.files?.length ?? 0);
        stored.onerror = () => resolve(0);
      };
      request.onerror = () => resolve(0);
    }))).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByText(/4 habitaciones abiertas/)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.editor-room-explorer__list > button')).toHaveCount(4);
    await expect(page.getByTestId('pokediscover-editor-runtime'))
      .toHaveAttribute('data-runtime', 'ready', { timeout: 20_000 });
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
    await expect(page.getByRole('complementary', { name: 'Inspector de propiedades' })).toContainText('anchor:nuevo');
    await expect(page.getByText(/archivo.*pendiente/)).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(page.getByRole('complementary', { name: 'Inspector de propiedades' })).toHaveCount(0);
  });

  test('mantiene alineados mapa y geometría y conserva la cámara entre habitaciones', async ({ page }) => {
    await openTegueste(page);
    const viewport = page.locator('.editor-map-viewport');
    const surface = page.locator('.editor-map-surface');
    const runtimeCanvas = page.getByTestId('pokediscover-editor-runtime').locator('canvas');
    const overlay = page.locator('.editor-geometry-overlay');

    await expect(viewport).toHaveAttribute('data-camera-zoom', '2');
    const initialBoxes = await Promise.all([
      surface.boundingBox(),
      runtimeCanvas.boundingBox(),
      overlay.boundingBox(),
    ]);
    expect(initialBoxes[0]).not.toBeNull();
    expect(initialBoxes[1]).toEqual(initialBoxes[0]);
    expect(initialBoxes[2]).toEqual(initialBoxes[0]);

    await page.getByRole('slider', { name: 'Zoom de la habitación' }).fill('1.8');
    await expect(viewport).toHaveAttribute('data-camera-zoom', '1.8');
    const zoomedBoxes = await Promise.all([
      surface.boundingBox(),
      runtimeCanvas.boundingBox(),
      overlay.boundingBox(),
    ]);
    expect(zoomedBoxes[1]).toEqual(zoomedBoxes[0]);
    expect(zoomedBoxes[2]).toEqual(zoomedBoxes[0]);

    await page.locator('.editor-room-explorer__list > button').filter({ hasText: '05-05' }).click();
    await expect(page.getByTestId('pokediscover-editor-runtime'))
      .toHaveAttribute('data-runtime', 'ready', { timeout: 20_000 });
    await expect(viewport).toHaveAttribute('data-camera-zoom', '1.8');

    await page.getByRole('button', { name: 'Mano' }).click();
    const beforePan = {
      x: Number(await viewport.getAttribute('data-camera-offset-x')),
      y: Number(await viewport.getAttribute('data-camera-offset-y')),
    };
    const viewportBox = await viewport.boundingBox();
    expect(viewportBox).not.toBeNull();
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(viewportBox.x + viewportBox.width / 2 + 96, viewportBox.y + viewportBox.height / 2 + 48);
    await page.mouse.up();
    await expect.poll(async () => ({
      x: Number(await viewport.getAttribute('data-camera-offset-x')),
      y: Number(await viewport.getAttribute('data-camera-offset-y')),
    })).toEqual({ x: beforePan.x + 96, y: beforePan.y + 48 });

    await page.getByRole('button', { name: 'Centrar habitación' }).click();
    await expect(viewport).toHaveAttribute('data-camera-zoom', '1.8');
    const centeredSurface = await surface.boundingBox();
    const centeredViewport = await viewport.boundingBox();
    expect(Math.abs(
      centeredSurface.x + centeredSurface.width / 2
      - (centeredViewport.x + centeredViewport.width / 2),
    )).toBeLessThan(1);
    expect(Math.abs(
      centeredSurface.y + centeredSurface.height / 2
      - (centeredViewport.y + centeredViewport.height / 2),
    )).toBeLessThan(1);

    expect(await page.evaluate(() => localStorage.getItem('pokediscover-editor-room-zoom'))).toBe('1.8');
    await page.getByRole('button', { name: 'Ver completo' }).click();
    await page.locator('.editor-world-room').filter({ hasText: '05-05' }).click();
    await expect(page.getByTestId('pokediscover-editor-runtime'))
      .toHaveAttribute('data-runtime', 'ready', { timeout: 20_000 });
    await expect(page.locator('.editor-map-viewport')).toHaveAttribute('data-camera-zoom', '1.8');
  });

  test('dibuja el .world en un único canvas y conserva los bordes contiguos', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', { name: 'Ver completo' }).click();

    const overview = page.getByRole('region', { name: 'Vista completa de la aventura' });
    const viewport = overview.locator('.editor-world-viewport');
    const surface = overview.locator('.editor-world-surface');
    const worldCanvas = overview.getByTestId('pokediscover-world-canvas');
    await expect(worldCanvas).toHaveCount(1);
    expect((await viewport.boundingBox()).height).toBeGreaterThan(300);
    await expect.poll(() => worldCanvas.evaluate(canvas => {
      const context = canvas.getContext('2d');
      if (!context || !canvas.width || !canvas.height) return false;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 64) {
        if (pixels[index] > 0) return true;
      }
      return false;
    })).toBe(true);
    await expect(page.getByTestId('pokediscover-editor-runtime')).toHaveCount(0);
    const positions = await overview.locator('.editor-world-room').evaluateAll(elements => Object.fromEntries(elements.map(element => {
      const label = element.querySelector('span')?.textContent.trim();
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
    expect(positions['03-05']).toEqual({ left: 960, top: 320, width: 480, height: 320 });
    await expect(overview.locator('.editor-world-room.is-pending')).toContainText('Mapa pendiente');

    await page.getByRole('slider', { name: 'Zoom de la vista completa' }).fill('1');
    const zoomAfterChange = await viewport.getAttribute('data-camera-zoom');
    const beforePan = {
      x: Number(await viewport.getAttribute('data-camera-offset-x')),
      y: Number(await viewport.getAttribute('data-camera-offset-y')),
    };
    const viewportBox = await viewport.boundingBox();
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(viewportBox.x + viewportBox.width / 2 + 80, viewportBox.y + viewportBox.height / 2 + 40);
    await page.mouse.up();
    await expect.poll(async () => ({
      x: Number(await viewport.getAttribute('data-camera-offset-x')),
      y: Number(await viewport.getAttribute('data-camera-offset-y')),
    })).toEqual({ x: beforePan.x + 80, y: beforePan.y + 40 });

    await overview.getByRole('button', { name: 'Centrar vista completa' }).click();
    await expect(viewport).toHaveAttribute('data-camera-zoom', zoomAfterChange);
    const centeredSurface = await surface.boundingBox();
    const centeredViewport = await viewport.boundingBox();
    expect(Math.abs(
      centeredSurface.x + centeredSurface.width / 2
      - (centeredViewport.x + centeredViewport.width / 2),
    )).toBeLessThan(1);
    expect(Math.abs(
      centeredSurface.y + centeredSurface.height / 2
      - (centeredViewport.y + centeredViewport.height / 2),
    )).toBeLessThan(1);
  });

  test('abre utilidades en ventanas y deja el lenguaje técnico en detalles avanzados', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', { name: 'Contenido' }).click();
    await page.getByRole('button', { name: 'Colocaciones' }).click();
    const placements = page.getByRole('region', { name: 'Colocaciones' });
    await expect(placements).toBeVisible();
    await expect(placements.getByText('Colocación de contenido')).toBeVisible();
    const entityScale = placements.getByRole('slider', { name: /Tamaño de la entidad/ }).first();
    await expect(entityScale).toBeVisible();
    await expect(entityScale).toHaveAttribute('min', '50');
    await expect(entityScale).toHaveAttribute('max', '150');
    await expect(entityScale).toHaveAttribute('step', '5');
    await expect(entityScale).toHaveValue('80');
    const placementRow = placements.locator('.editor-content__placed li > button').first();
    expect((await placementRow.boundingBox()).width).toBeGreaterThan(250);

    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
    await page.getByRole('button', { name: 'Entradas del jugador' }).click();
    const entries = page.getByRole('region', { name: 'Entradas del jugador' });
    await expect(entries).toContainText('Llegada para ayudar al profesor');
    await expect(entries).toContainText('Expedición libre');
    await expect(entries.getByText('entry-point:tegueste-forest:camphor-rescue')).toBeHidden();
    await entries.getByText('Detalles avanzados').click();
    await expect(entries).toContainText('entry-point:tegueste-forest:camphor-rescue');
  });

  test('confina las ventanas flotantes al lienzo al moverlas y maximizarlas', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', { name: 'Herramientas' }).click();
    await page.getByRole('button', { name: 'Catálogo' }).click();
    const utility = page.getByRole('region', { name: 'Catálogo', exact: true });
    const bounds = page.locator('.editor-window-bounds');

    await utility.getByRole('button', { name: 'Maximizar Catálogo' }).click();
    const [maximizedBox, boundsBox] = await Promise.all([
      utility.boundingBox(),
      bounds.boundingBox(),
    ]);
    expect(maximizedBox).toEqual(boundsBox);

    await utility.getByRole('button', { name: 'Restaurar Catálogo' }).click();
    const titlebar = utility.locator('.editor-window__titlebar');
    const titlebarBox = await titlebar.boundingBox();
    await page.mouse.move(titlebarBox.x + 80, titlebarBox.y + 16);
    await page.mouse.down();
    await page.mouse.move(0, 0);
    await page.mouse.up();
    const movedBox = await utility.boundingBox();
    expect(Math.round(movedBox.x)).toBe(Math.round(boundsBox.x));
    expect(Math.round(movedBox.y)).toBe(Math.round(boundsBox.y));
  });

  test('abre las propiedades de una colocación en un inspector que reduce el lienzo', async ({ page }) => {
    await openTegueste(page);
    const viewport = page.locator('.editor-map-viewport');
    const initialBox = await viewport.boundingBox();

    await page.getByRole('button', {
      name: 'Editar colocación character:scientist:one',
      exact: true,
    }).click();
    const inspector = page.getByRole('complementary', { name: 'Inspector de propiedades' });
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('character:npc:scientist');
    const reducedBox = await viewport.boundingBox();
    expect(reducedBox.width).toBeLessThan(initialBox.width);

    await inspector.getByRole('combobox', { name: 'Orientación' }).selectOption('right');
    await expect(inspector.getByRole('combobox', { name: 'Orientación' })).toHaveValue('right');
    await inspector.getByRole('button', { name: 'Cerrar propiedades' }).click();
    await expect(inspector).toHaveCount(0);
    await expect.poll(async () => (await viewport.boundingBox()).width).toBe(initialBox.width);
  });

  test('muestra la grilla, señala el recentrado y abre el menú de una celda', async ({ page }) => {
    await openTegueste(page);
    await page.locator('.editor-room-explorer__list > button').filter({ hasText: '05-05' }).click();
    const viewport = page.locator('.editor-map-viewport');
    const gridToggle = page.getByRole('button', { name: 'Mostrar grilla' });
    const center = page.getByRole('button', { name: 'Centrar habitación' });
    await gridToggle.click();
    await expect(gridToggle).toHaveAttribute('aria-pressed', 'true');
    const grid = page.locator('.editor-map-grid');
    const gridLine = page.locator('pattern .editor-map-grid-line');
    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('x', '-16');
    await expect(grid).toHaveAttribute('y', '-16');
    await expect(gridLine).toHaveCSS('fill', 'none');
    await expect(gridLine).toHaveCSS('stroke', 'rgb(255, 79, 79)');
    await expect(gridLine).toHaveCSS('stroke-dasharray', '4px, 4px');
    expect(await page.evaluate(() => localStorage.getItem('pokediscover-editor-room-grid'))).toBe('true');
    await expect(page.getByRole('slider', { name: 'Zoom de la habitación' }).locator('..'))
      .toHaveAttribute('data-tooltip', /cambia el tamaño visual/);
    await expect(center.locator('..')).toHaveAttribute('data-tooltip', /centrado/);
    await expect(gridToggle.locator('..')).toHaveAttribute('data-tooltip', /Oculta la rejilla/);
    await expect(page.getByRole('slider', { name: 'Zoom de la habitación' })).not.toHaveAttribute('title', /.+/);
    await expect(center).not.toHaveAttribute('title', /.+/);
    await expect(gridToggle).not.toHaveAttribute('title', /.+/);
    await expect(page.locator('.editor-layer-toggles')).toHaveCSS('border-left-style', 'none');

    await expect(center).toBeDisabled();
    await page.getByRole('button', { name: 'Mano', exact: true }).click();
    const bounds = await viewport.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2 + 40);
    await page.mouse.up();
    await expect(center).toBeEnabled();
    await expect(center).toHaveClass(/is-actionable/);
    await center.click();
    await expect(center).toBeDisabled();

    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.locator('.editor-geometry-overlay').click({ position: { x: 120, y: 110 } });
    const menu = page.getByRole('menu', { name: 'Añadir en la celda' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(12);

    await page.locator('.editor-geometry-overlay').click({ position: { x: 390, y: 270 } });
    await expect(menu).toHaveCount(0);

    await page.locator('.editor-geometry-overlay').click({ position: { x: 120, y: 110 } });
    const menuBounds = await menu.boundingBox();
    await page.mouse.move(menuBounds.x + menuBounds.width + 110, menuBounds.y + menuBounds.height + 110);
    await expect(menu).toHaveCount(0);
  });

  test('permite exigir Shift para crear desde el lienzo y recuerda la preferencia', async ({ page }) => {
    await openTegueste(page);
    await page.locator('.editor-room-explorer__list > button').filter({ hasText: '05-05' }).click();
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.getByRole('button', { name: 'Herramientas', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir manteniendo Shift' }).click();
    expect(await page.evaluate(() => localStorage.getItem('pokediscover-editor-direct-authoring-gesture')))
      .toBe('shift');

    const overlay = page.locator('.editor-geometry-overlay');
    await overlay.click({ position: { x: 120, y: 110 } });
    await expect(page.getByRole('menu', { name: 'Añadir en la celda' })).toHaveCount(0);
    await overlay.click({ position: { x: 120, y: 110 }, modifiers: ['Shift'] });
    await expect(page.getByRole('menu', { name: 'Añadir en la celda' })).toBeVisible();
    await overlay.click({ position: { x: 390, y: 270 } });

    const pathsBefore = await page.locator('.editor-geometry-object.is-paths').count();
    const bounds = await overlay.boundingBox();
    await page.keyboard.down('Shift');
    await page.mouse.move(bounds.x + 90, bounds.y + 90);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 180, bounds.y + 90, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.locator('.editor-geometry-object.is-paths')).toHaveCount(pathsBefore + 1);

    await page.getByRole('button', { name: 'Herramientas', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Añadir manteniendo Shift' }))
      .toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Añadir con clic o arrastre' }).click();
    expect(await page.evaluate(() => localStorage.getItem('pokediscover-editor-direct-authoring-gesture')))
      .toBe('direct');
  });

  test('dibuja una ruta ortogonal arrastrando por celdas vacías', async ({ page }) => {
    await openTegueste(page);
    await page.locator('.editor-room-explorer__list > button').filter({ hasText: '05-05' }).click();
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    const overlay = page.locator('.editor-geometry-overlay');
    const bounds = await overlay.boundingBox();
    await page.mouse.move(bounds.x + 90, bounds.y + 90);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 190, bounds.y + 90, { steps: 4 });
    await page.mouse.move(bounds.x + 190, bounds.y + 170, { steps: 4 });
    await page.mouse.up();

    const inspector = page.getByRole('complementary', { name: 'Inspector de propiedades' });
    await expect(inspector).toContainText('path:nuevo');
    const points = await page.locator('.editor-geometry-object.is-paths.is-selected').getAttribute('points');
    const parsed = points.trim().split(/\s+/).map(point => point.split(',').map(Number));
    expect(parsed.length).toBeGreaterThanOrEqual(3);
    expect(parsed.slice(1).every((point, index) => (
      point[0] === parsed[index][0] || point[1] === parsed[index][1]
    ))).toBe(true);
  });

  test('crea contenido desde una celda sin dejar anclas al cancelar', async ({ page }) => {
    await openTegueste(page);
    await page.locator('.editor-room-explorer__list > button').filter({ hasText: '05-05' }).click();
    const overlay = page.locator('.editor-geometry-overlay');
    const anchorsBefore = await page.locator('.editor-geometry-object.is-anchors').count();
    await overlay.click({ position: { x: 120, y: 110 } });
    await page.getByRole('menuitem', { name: 'Pokémon' }).click();
    await expect(page.getByRole('region', { name: 'Nuevo Pokémon' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar creación' }).click();
    await expect(page.locator('.editor-geometry-object.is-anchors')).toHaveCount(anchorsBefore);

    await overlay.click({ position: { x: 120, y: 110 } });
    await page.getByRole('menuitem', { name: 'Personaje / NPC' }).click();
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    const inspector = page.getByRole('complementary', { name: 'Inspector de propiedades' });
    await expect(inspector).toContainText('Entidad seleccionada');
    await expect(page.getByRole('button', { name: /Guardar .*archivos? pendientes?/ })).toBeVisible();
  });

  test('edita un guion automático y protege la salida con cambios pendientes', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', {
      name: 'Editar colocación character:scientist:one',
      exact: true,
    }).click();
    const inspector = page.getByRole('complementary', { name: 'Inspector de propiedades' });
    await expect(inspector.getByText('Guion automático')).toBeVisible();
    const createSequence = inspector.getByRole('button', { name: 'Crear secuencia' });
    if (await createSequence.isVisible()) await createSequence.click();
    await inspector.getByRole('combobox', { name: 'Tipo' }).selectOption('setVisible');
    await expect(inspector.getByRole('checkbox', { name: 'Entidad visible' })).toBeChecked();
    const actionSelect = inspector.getByRole('combobox', { name: 'Acción del paso' });
    const actionCount = await actionSelect.locator('option').count();
    await inspector.getByRole('button', { name: 'Duplicar acción' }).click();
    await expect(actionSelect.locator('option')).toHaveCount(actionCount + 1);
    await inspector.getByRole('button', { name: 'Anterior' }).click();
    await expect(actionSelect).toHaveValue('0');
    await inspector.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('button', { name: /Guardar .*archivos? pendientes?/ })).toBeVisible();

    await page.getByRole('link', { name: 'PokeDiscover' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Cambios sin guardar' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Descartar' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /continuar/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page).toHaveURL(/pokediscover-editor/);
  });

  test('renombra el título y organiza piezas pendientes como una sola transacción', async ({ page }) => {
    await openTegueste(page);

    await page.locator('.editor-appbar__document > button').click();
    const title = page.getByRole('textbox', { name: 'Nombre del mapa' });
    await title.fill('Bosque de Tegueste revisado');
    await title.press('Enter');
    await expect(page.locator('.editor-appbar__document')).toContainText('Bosque de Tegueste revisado');

    await page.getByRole('button', { name: 'Habitaciones 4/5' }).click();
    await expect(page.locator('.editor-world-organizer')).toContainText('Organizar mundo');
    await expect(page.locator('.editor-world-room')).toHaveCount(5);
    await expect(page.locator('.editor-world-room.is-pending')).toContainText('Mapa pendiente');
    await page.getByRole('button', { name: 'Añadir pieza' }).click();
    await expect(page.locator('.editor-world-room')).toHaveCount(6);
    await page.getByRole('button', { name: 'Aplicar organización' }).click();
    await expect(page.getByRole('button', { name: 'Habitaciones 4/6' })).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: 'Habitaciones 4/5' })).toBeVisible();
  });

  test('coloca un Pokémon al 150% con ruta y lo reproduce en modo Probar', async ({ page }) => {
    await openTegueste(page);
    await page.getByRole('button', { name: 'Contenido' }).click();
    await page.getByRole('button', { name: 'Colocaciones' }).click();
    const placements = page.getByRole('region', { name: 'Colocaciones' });
    await placements.getByRole('slider', { name: /Tamaño de la entidad/ }).first().fill('150');
    await placements.getByRole('combobox', { name: 'Movimiento' }).selectOption('path');
    await expect(placements.getByRole('combobox', { name: 'Ruta' })).not.toHaveValue('');
    await placements.getByRole('button', { name: 'Confirmar colocación' }).click();
    await expect(placements.getByText(/Entidad seleccionada/)).toBeVisible();
    await expect(placements.getByRole('slider', { name: /Tamaño de la entidad/ }).last()).toHaveValue('150');

    await page.getByRole('group', { name: 'Modo de visualización' })
      .getByRole('button', { name: 'Probar', exact: true }).click();
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
      if (viewport.width === 1280) {
        const explorer = page.getByRole('complementary', { name: 'Explorador de habitaciones' });
        const ribbon = page.locator('.editor-menu__popover');
        const explorerHeader = explorer.locator(':scope > header');
        const [explorerBox, ribbonBox, headerBox] = await Promise.all([
          explorer.boundingBox(),
          ribbon.boundingBox(),
          explorerHeader.boundingBox(),
        ]);
        expect(Math.round(ribbonBox.x)).toBe(Math.round(explorerBox.x + explorerBox.width));
        expect(Math.round(ribbonBox.y)).toBe(Math.round(headerBox.y));
        await expect(explorer.locator(':scope > footer')
          .getByRole('group', { name: 'Modo de visualización' })).toBeVisible();
        await expect(page.locator('.editor-statusbar')
          .getByRole('group', { name: 'Modo de visualización' })).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'Herramientas' }).click();
      await page.getByRole('button', { name: 'Catálogo' }).click();
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
