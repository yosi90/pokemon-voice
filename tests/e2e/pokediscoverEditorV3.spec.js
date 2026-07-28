import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test.describe('Mapas V3 y autoría garantizada', () => {
  test.setTimeout(60_000);
  test.skip(({ viewport }) => viewport && viewport.width < 1280, 'La edición solo se ofrece en escritorio.');

  test('bloquea V2 hasta crear la copia y confirmar la migración', async ({ page }) => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pokediscover-v2-clean-'));
    const mapDirectory = path.join(temporaryRoot, 'map');
    try {
      await cp('public/assets/adventure/maps/tegueste-forest', mapDirectory, {
        recursive: true,
      });
      await cp(
        path.join(mapDirectory, 'tegueste-forest.adventure.v2.backup.json'),
        path.join(mapDirectory, 'tegueste-forest.adventure.json'),
      );
      await rm(
        path.join(mapDirectory, 'tegueste-forest.adventure.v2.backup.json'),
        { force: true },
      );
      await page.goto('/tools/pokediscover-editor/');
      await page.getByTestId('adventure-folder').setInputFiles(mapDirectory);
      const migration = page.getByRole('alertdialog', { name: 'Migración explícita a Mapas V3' });
      await expect(migration).toBeVisible({ timeout: 20_000 });
      await expect(migration).toContainText('tegueste-forest.adventure.v2.backup.json');
      const download = page.waitForEvent('download');
      await migration.getByRole('button', { name: 'Crear copia y migrar a V3' }).click();
      expect((await download).suggestedFilename()).toBe(
        'tegueste-forest.adventure.v2.backup.json',
      );
      const sanitation = page.getByRole('alertdialog', {
        name: 'Reparto Pokémon del sector',
      });
      await expect(sanitation).toBeVisible();
      await expect(sanitation.getByLabel(/Incidencia 1 de/u)).toBeVisible();
      await expect(sanitation.getByRole('region', { name: 'Reparto del sector' })).toBeVisible();
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('reutiliza un backup V2 idéntico creado hace menos de una hora', async ({ page }) => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pokediscover-v2-'));
    const mapDirectory = path.join(temporaryRoot, 'map');
    try {
      await cp('public/assets/adventure/maps/tegueste-forest', mapDirectory, {
        recursive: true,
      });
      const sidecar = await readFile(
        path.join(mapDirectory, 'tegueste-forest.adventure.v2.backup.json'),
        'utf8',
      );
      await writeFile(
        path.join(mapDirectory, 'tegueste-forest.adventure.json'),
        sidecar,
        'utf8',
      );
      await writeFile(
        path.join(mapDirectory, 'tegueste-forest.adventure.v2.backup.json'),
        sidecar,
        'utf8',
      );

      await page.goto('/tools/pokediscover-editor/');
      await page.getByTestId('adventure-folder').setInputFiles(mapDirectory);
      const migration = page.getByRole('alertdialog', {
        name: 'Migración explícita a Mapas V3',
      });
      await expect(migration).toContainText(
        'Ya existe la copia reciente tegueste-forest.adventure.v2.backup.json',
        { timeout: 20_000 },
      );
      await expect(migration.getByRole('button', {
        name: 'Crear copia y migrar a V3',
      })).toHaveCount(0);
      await migration.getByRole('button', {
        name: 'Usar copia reciente y migrar a V3',
      }).click();
      await expect(page.getByRole('alertdialog', {
        name: 'Reparto Pokémon del sector',
      })).toBeVisible();
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('mantiene el borrador fuera del TMJ y confirma una receta validada', async ({ page }) => {
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder').setInputFiles('tests/fixtures/editor-v3');
    await expect(page.locator('.editor-statusbar')).toContainText('1 sectores abiertos', {
      timeout: 20_000,
    });
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    const overlay = page.locator('.editor-geometry-overlay');
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(0);
    await overlay.click({ position: { x: 80, y: 64 } });
    await page.getByRole('menu', { name: 'Añadir en la celda' })
      .getByRole('menuitem', { name: 'Pokémon' }).click();

    const wizard = page.getByRole('region', { name: 'Asistente de creación' });
    await expect(wizard).toContainText('Borrador fuera del mapa');
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(0);
    await wizard.getByRole('button', { name: 'Cancelar creación' }).click();
    await expect(wizard).toHaveCount(0);
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(0);

    await overlay.click({ position: { x: 80, y: 64 } });
    await page.getByRole('menu', { name: 'Añadir en la celda' })
      .getByRole('menuitem', { name: 'Pokémon' }).click();
    await wizard.getByRole('button', { name: 'Continuar' }).click();
    await expect(wizard.getByText('Integrante del reparto del sector')).toBeVisible();
    await wizard.getByRole('button', { name: 'Continuar' }).click();
    await expect(wizard).toContainText('placement:pokemon:bulbasaur:default:01');
    await expect(wizard).toContainText('ActorAnchor');
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(0);
    await wizard.getByRole('button', { name: 'Confirmar y crear' }).click();

    await expect(wizard).toHaveCount(0);
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: 'Inspector de propiedades' }))
      .toContainText('placement:pokemon:bulbasaur:default:01');
    await page.keyboard.press('Control+z');
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(0);
  });

  test('mueve una entidad y dibuja, cancela y confirma una ruta gestual como una transacción', async ({ page }) => {
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder')
      .setInputFiles('public/assets/adventure/maps/tegueste-forest');
    await expect(page.locator('.editor-statusbar')).toContainText('4 sectores abiertos', {
      timeout: 20_000,
    });
    await page.locator('.editor-room-explorer__list > button')
      .filter({ hasText: '02-05' })
      .click();
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();

    const marker = page.getByRole('button', {
      name: 'Editar colocación character:scientist:one',
      exact: true,
    });
    await marker.click();
    const inspector = page.getByRole('complementary', { name: 'Inspector de propiedades' });
    await expect(inspector.getByText('Movimientos y eventos')).toBeVisible();

    const initialBox = await marker.boundingBox();
    await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(initialBox.x + initialBox.width / 2 + 36, initialBox.y + initialBox.height / 2);
    await page.mouse.up();
    await expect.poll(async () => Math.round((await marker.boundingBox()).x))
      .not.toBe(Math.round(initialBox.x));
    await page.keyboard.press('Control+z');
    await expect.poll(async () => Math.round((await marker.boundingBox()).x))
      .toBe(Math.round(initialBox.x));

    const drawRoute = async () => {
      const box = await marker.boundingBox();
      await page.keyboard.down('Shift');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 5 });
      await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 40, { steps: 4 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
    };

    const pathsBefore = await page.locator('.editor-geometry-object.is-paths').count();
    await drawRoute();
    await expect(page.locator('.editor-placement-path-draft')).toBeVisible();
    await expect(inspector).toContainText(/Nueva ruta/);
    const pendingBeforeCancel = await page.getByRole('button', {
      name: /Guardar .*archivos? pendientes?/,
    }).count();
    await inspector.getByRole('button', { name: 'Cancelar ruta' }).click();
    await expect(page.locator('.editor-placement-path-draft')).toHaveCount(0);
    await expect(page.locator('.editor-geometry-object.is-paths')).toHaveCount(pathsBefore);
    await expect(page.getByRole('button', {
      name: /Guardar .*archivos? pendientes?/,
    })).toHaveCount(pendingBeforeCancel);

    await drawRoute();
    await inspector.getByRole('button', { name: 'Confirmar ruta' }).click();
    await expect(page.locator('.editor-placement-path-draft')).toHaveCount(0);
    await expect(page.locator('.editor-geometry-object.is-paths')).toHaveCount(pathsBefore + 1);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.editor-geometry-object.is-paths')).toHaveCount(pathsBefore);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.editor-geometry-object.is-paths')).toHaveCount(pathsBefore + 1);

    await drawRoute();
    await inspector.getByRole('combobox', { name: 'Añadir a' }).selectOption('');
    await inspector.getByRole('button', { name: 'Evento activado' }).click();
    await inspector.getByRole('combobox', { name: 'Repetición' })
      .selectOption('oncePerSectorVisit');
    await inspector.getByRole('button', { name: 'Dibujar área en el mapa' }).click();
    const overlay = page.locator('.editor-geometry-overlay');
    const overlayBox = await overlay.boundingBox();
    await page.mouse.move(overlayBox.x + 80, overlayBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(overlayBox.x + 130, overlayBox.y + 120);
    await page.mouse.up();
    await expect(page.locator('.editor-trigger-zone-draft')).toBeVisible();
    await inspector.getByRole('button', { name: 'Confirmar ruta' }).click();
    await expect(page.locator('.editor-trigger-zone-draft')).toHaveCount(0);
    await expect(page.locator('.editor-geometry-object.is-paths')).toHaveCount(pathsBefore + 2);
    await page.getByRole('button', { name: 'Zonas de evento' }).click();
    await expect(page.locator('.editor-geometry-object.is-triggers')).toHaveCount(1);
  });

  test('presenta el reparto del sector con el mismo espaciado del saneamiento', async ({ page }) => {
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder').setInputFiles('tests/fixtures/editor-v3');
    await expect(page.locator('.editor-statusbar')).toContainText('1 sectores abiertos', {
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Contenido' }).click();
    await page.getByRole('button', { name: 'Reparto del sector' }).click();

    const rosterWindow = page.locator('.editor-window.is-roster');
    await expect(rosterWindow).toBeVisible();
    await expect(rosterWindow.locator('.editor-window__content')).toHaveCSS('padding', '18px');
    await expect(rosterWindow.locator('.editor-roster-editor > header')).toBeHidden();
    await expect(rosterWindow.locator('.editor-roster-copy'))
      .toHaveCSS('background-color', 'rgb(255, 248, 207)');
    await expect(rosterWindow.getByRole('button', { name: '1. Pokémon' }))
      .toHaveCSS('border-radius', '7px');
  });

  test('limpia el contador después de guardar mediante una copia exportada', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder').setInputFiles('tests/fixtures/editor-v3');
    await expect(page.locator('.editor-statusbar')).toContainText('1 archivo pendiente', {
      timeout: 20_000,
    });

    const saveButton = page.locator('.editor-canvas-save');
    await expect(saveButton).toBeVisible();
    const download = page.waitForEvent('download');
    await saveButton.click();
    await download;

    await expect(saveButton).toHaveCount(0);
    await expect(page.locator('.editor-statusbar')).toContainText('Guardado');

    await page.reload();
    await expect(page.locator('.editor-statusbar')).toContainText('1 sectores abiertos', {
      timeout: 20_000,
    });
    await expect(page.locator('.editor-statusbar')).toContainText('Guardado');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('crea un evento desde un comentario y permite cancelar sin cambios', async ({ page }) => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pokediscover-map-event-'));
    const mapDirectory = path.join(temporaryRoot, 'map');
    try {
      await cp('tests/fixtures/editor-v3', mapDirectory, { recursive: true });
      const sidecarPath = path.join(mapDirectory, 'editor-v3.adventure.json');
      const tmjPath = path.join(mapDirectory, 'editor-v3.tmj');
      const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
      sidecar.sectors[0].roster.pokemonAssetIds.push('pmd:0279-pelipper:default');
      sidecar.requiredAssetIds.push('pmd:0279-pelipper:default');
      sidecar.actorPlacements.push({
        schemaVersion: 1,
        placementId: 'placement:pokemon:pelipper:default:01',
        sectorId: 'sector:editor-e2e:01',
        anchorId: 'placement:pokemon:pelipper:default:01',
        assetId: 'pmd:0279-pelipper:default',
        animation: 'Sleep',
        direction: 'down',
      });
      const tilemap = JSON.parse(await readFile(tmjPath, 'utf8'));
      tilemap.layers.find(layer => layer.name === 'Anchors').objects.push({
        class: 'ActorAnchor',
        id: 65,
        name: 'placement:pokemon:pelipper:default:01',
        point: true,
        rotation: 0,
        visible: true,
        x: 80,
        y: 64,
      });
      tilemap.layers.push({
        draworder: 'topdown',
        id: 5,
        name: 'Comments',
        objects: [{
          class: 'EditorComment',
          id: 66,
          name: 'comment:01',
          rotation: 0,
          visible: true,
          x: 96,
          y: 48,
          width: 32,
          height: 32,
          properties: [{ name: 'text', type: 'string', value: 'Pelipper despierta aquí' }],
        }],
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
      });
      tilemap.nextlayerid = 6;
      tilemap.nextobjectid = 67;
      await writeFile(sidecarPath, JSON.stringify(sidecar), 'utf8');
      await writeFile(tmjPath, JSON.stringify(tilemap), 'utf8');

      await page.goto('/tools/pokediscover-editor/');
      await page.getByTestId('adventure-folder').setInputFiles(mapDirectory);
      await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 20_000 });
      await page.getByRole('button', { name: 'Comentarios' }).click();
      const comment = page.locator('.editor-geometry-object.is-comments');
      await expect(comment).toHaveCount(1);
      await comment.click();
      await page.getByRole('button', { name: 'Crear evento aquí' }).click();
      const wizard = page.getByRole('region', { name: 'Crear evento desde comentario' });
      await expect(wizard).toBeVisible();
      await wizard.getByRole('button', { name: 'Cancelar evento' }).click();
      await expect(comment).toHaveCount(1);

      await comment.click();
      await page.getByRole('button', { name: 'Crear evento aquí' }).click();
      await wizard.getByRole('button', { name: 'Continuar' }).click();
      await wizard.getByRole('button', { name: 'Continuar' }).click();
      await wizard.getByLabel('Animación final').selectOption('Idle');
      await wizard.getByRole('button', { name: 'Continuar' }).click();
      await wizard.getByRole('button', { name: 'Crear evento' }).click();
      await expect(wizard).toHaveCount(0);
      await expect(page.locator('.editor-geometry-object.is-comments')).toHaveCount(0);
      await page.getByRole('button', { name: 'Zonas de evento' }).click();
      await expect(page.locator('.editor-geometry-object.is-triggers')).toHaveCount(1);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('adapta un ancla Pokémon huérfana como colocación inicial', async ({ page }) => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pokediscover-orphan-'));
    const mapDirectory = path.join(temporaryRoot, 'map');
    try {
      await cp('tests/fixtures/editor-v3', mapDirectory, { recursive: true });
      const sidecarPath = path.join(mapDirectory, 'editor-v3.adventure.json');
      const tmjPath = path.join(mapDirectory, 'editor-v3.tmj');
      const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
      sidecar.sectors[0].roster.pokemonAssetIds.push('pmd:0279-pelipper:default');
      sidecar.requiredAssetIds.push('pmd:0279-pelipper:default');
      const tilemap = JSON.parse(await readFile(tmjPath, 'utf8'));
      tilemap.layers.find(layer => layer.name === 'Anchors').objects.push({
        class: 'ActorAnchor',
        id: 65,
        name: 'anchor:pelipper',
        point: true,
        rotation: 0,
        visible: true,
        x: 80,
        y: 64,
      }, {
        class: 'ActorAnchor',
        id: 66,
        name: 'anchor:mystery',
        point: true,
        rotation: 0,
        visible: true,
        x: 96,
        y: 64,
      });
      tilemap.nextobjectid = 67;
      await writeFile(sidecarPath, JSON.stringify(sidecar), 'utf8');
      await writeFile(tmjPath, JSON.stringify(tilemap), 'utf8');

      await page.goto('/tools/pokediscover-editor/');
      await page.getByTestId('adventure-folder').setInputFiles(mapDirectory);
      const sanitation = page.getByRole('alertdialog', {
        name: 'Saneamiento obligatorio del mapa',
      });
      await expect(sanitation).toContainText(
        'anchor:pelipper es un ancla funcionalmente huérfana',
        { timeout: 20_000 },
      );
      await expect(sanitation.getByRole('region', {
        name: 'Adaptar ancla Pokémon',
      })).toContainText('Pelipper');
      await expect(sanitation.getByRole('button', {
        name: 'Eliminar',
        exact: true,
      })).toBeEnabled();
      await expect(sanitation.getByLabel('Comentario para conservar en el sector'))
        .toHaveCount(0);
      await sanitation.getByRole('button', { name: 'Eliminar', exact: true }).click();
      const deleteDialog = page.getByRole('alertdialog', { name: 'Eliminar elemento' });
      await expect(deleteDialog.getByLabel('Comentario para conservar en el sector'))
        .toHaveValue('Ancla eliminada durante la migración\nanchor:pelipper');
      await deleteDialog.getByRole('button', { name: 'Cancelar' }).click();
      await sanitation.getByLabel('Animación inicial del Pokémon')
        .selectOption('Sleep');
      await sanitation.getByRole('button', {
        name: 'Corregir y continuar',
      }).click();
      await expect(sanitation.getByLabel('Incidencia 2 de 2')).toBeVisible();
      await expect(sanitation).toContainText(
        'anchor:mystery es un ancla funcionalmente huérfana',
      );
      await sanitation.getByRole('button', { name: 'Volver atrás' }).click();
      await expect(sanitation).toContainText(
        'anchor:pelipper es un ancla funcionalmente huérfana',
      );
      await sanitation.getByLabel('Animación inicial del Pokémon')
        .selectOption('Sleep');
      await sanitation.getByRole('button', { name: 'Corregir y continuar' }).click();
      await expect(sanitation).toContainText(
        'anchor:mystery es un ancla funcionalmente huérfana',
      );
      await sanitation.getByRole('button', { name: 'Eliminar', exact: true }).click();
      await expect(sanitation).toHaveCount(0);
      await expect(page.locator('.editor-geometry-object.is-anchors')).toHaveCount(1);
      await expect(page.getByRole('complementary', {
        name: 'Inspector de propiedades',
      })).toContainText('placement:pokemon:pelipper:default:01');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('separa una ancla compartida por varias colocaciones', async ({ page }) => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pokediscover-shared-anchor-'));
    const mapDirectory = path.join(temporaryRoot, 'map');
    try {
      await cp('tests/fixtures/editor-v3', mapDirectory, { recursive: true });
      const sidecarPath = path.join(mapDirectory, 'editor-v3.adventure.json');
      const tmjPath = path.join(mapDirectory, 'editor-v3.tmj');
      const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
      sidecar.actorPlacements = [{
        schemaVersion: 1,
        placementId: 'placement:pokemon:01',
        sectorId: 'sector:editor-e2e:01',
        anchorId: 'anchor:shared',
        assetId: 'pmd:0001-bulbasaur:default',
        animation: 'Idle',
      }, {
        schemaVersion: 1,
        placementId: 'placement:pokemon:02',
        sectorId: 'sector:editor-e2e:01',
        anchorId: 'anchor:shared',
        assetId: 'pmd:0004-charmander:default',
        animation: 'Idle',
      }];
      const tilemap = JSON.parse(await readFile(tmjPath, 'utf8'));
      tilemap.layers.find(layer => layer.name === 'Anchors').objects.push({
        class: 'ActorAnchor',
        id: 52,
        name: 'anchor:shared',
        point: true,
        rotation: 0,
        visible: true,
        x: 80.12345,
        y: 64.98765,
      });
      tilemap.nextobjectid = 53;
      await writeFile(sidecarPath, JSON.stringify(sidecar), 'utf8');
      await writeFile(tmjPath, JSON.stringify(tilemap), 'utf8');

      await page.goto('/tools/pokediscover-editor/');
      await page.getByTestId('adventure-folder').setInputFiles(mapDirectory);
      const sanitation = page.getByRole('alertdialog', {
        name: 'Saneamiento obligatorio del mapa',
      });
      await expect(sanitation).toContainText(
        'anchor:shared está compartida por varias colocaciones y debe separarse',
        { timeout: 20_000 },
      );
      await expect(sanitation).toContainText('x 80.12 · y 64.98 · punto');
      await sanitation.getByRole('button', { name: 'Corregir y continuar' }).click();
      await expect(sanitation).toHaveCount(0);
      await expect(page.locator('.editor-geometry-object.is-anchors')).toHaveCount(2);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('bloquea el wizard cuando el reparto tiene menos de cinco Pokémon', async ({ page }) => {
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder').setInputFiles(
      'tests/fixtures/editor-v3-invalid-roster',
    );
    const pokemonDialog = page.getByRole('alertdialog', { name: 'Reparto Pokémon del sector' });
    await expect(pokemonDialog).toContainText('al menos 5 assets Pokémon', { timeout: 20_000 });
    await expect(pokemonDialog.getByRole('region', { name: 'Reparto del sector' })).toBeVisible();
    await expect(pokemonDialog.getByLabel('Incidencia 1 de 2')).toBeVisible();
    await expect(pokemonDialog.getByLabel('Primeros Pokémon encontrados').getByRole('button'))
      .toHaveCount(5);
    await pokemonDialog.getByRole('button', { name: 'Continuar a NPC' }).click();
    await expect(pokemonDialog.getByRole('alert')).toContainText(
      'Selecciona al menos 5 Pokémon distintos para continuar. Te faltan 1.',
    );

    await pokemonDialog.getByRole('searchbox', { name: 'Buscar Pokémon para el reparto' })
      .fill('Pikachu');
    await pokemonDialog.getByRole('button', { name: 'Añadir Pikachu' }).click();
    await expect(pokemonDialog.getByLabel('Incidencia 1 de 2')).toBeVisible();
    await pokemonDialog.getByRole('button', { name: 'Continuar a NPC' }).click();
    const npcDialog = page.getByRole('alertdialog', { name: 'Reparto NPC del sector' });
    await expect(npcDialog).toBeVisible();
    await expect(npcDialog.getByLabel('NPC encontrados').getByRole('button'))
      .toHaveCount(3);
    await npcDialog.getByRole('button', { name: 'Finalizar sin NPC' }).click();

    const queue = page.getByRole('alertdialog', { name: 'Saneamiento obligatorio del mapa' });
    await expect(queue.getByLabel('Incidencia 2 de 2')).toBeVisible();
    await expect(queue).toContainText('Objeto Tiled #60');
    await expect(queue).toContainText('capa Collision');
    await expect(queue.getByText('collision:01', { exact: true })).toBeVisible();
    await expect(queue.locator('.editor-sanitation-derived-values'))
      .toContainText('Collision');
    await expect(queue.locator('.editor-sanitation-footer')).toContainText(
      'editor-v3-invalid.tmj',
    );
    await expect(queue.locator('.editor-sanitation-footer')).toContainText(
      'sector:editor-e2e-invalid:01',
    );
    await queue.getByRole('button', { name: 'Corregir y continuar' }).click();
    await expect(queue).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Asistente de creación' })).toHaveCount(0);
  });
});
