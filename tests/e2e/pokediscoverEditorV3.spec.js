import { expect, test } from '@playwright/test';

test.describe('Mapas V3 y autoría garantizada', () => {
  test.setTimeout(60_000);
  test.skip(({ viewport }) => viewport && viewport.width < 1280, 'La edición solo se ofrece en escritorio.');

  test('bloquea V2 hasta crear la copia y confirmar la migración', async ({ page }) => {
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder').setInputFiles(
      'public/assets/adventure/maps/tegueste-forest',
    );
    const migration = page.getByRole('alertdialog', { name: 'Migración explícita a Mapas V3' });
    await expect(migration).toBeVisible({ timeout: 20_000 });
    await expect(migration).toContainText('tegueste-forest.adventure.v2.backup.json');
    const download = page.waitForEvent('download');
    await migration.getByRole('button', { name: 'Crear copia y migrar a V3' }).click();
    expect((await download).suggestedFilename()).toBe(
      'tegueste-forest.adventure.v2.backup.json',
    );
    await expect(page.getByRole('alertdialog', { name: 'Saneamiento obligatorio del mapa' }))
      .toBeVisible();
    await expect(page.getByText(/La autoría normal seguirá bloqueada/u)).toBeVisible();
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
    await expect(wizard).toContainText('placement:pokemon:01');
    await expect(wizard).toContainText('ActorAnchor');
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(0);
    await wizard.getByRole('button', { name: 'Confirmar y crear' }).click();

    await expect(wizard).toHaveCount(0);
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: 'Inspector de propiedades' }))
      .toContainText('placement:pokemon:01');
    await page.keyboard.press('Control+z');
    await expect(overlay.locator('.editor-geometry-object.is-anchors')).toHaveCount(0);
  });

  test('bloquea el wizard cuando el reparto tiene menos de cinco Pokémon', async ({ page }) => {
    await page.goto('/tools/pokediscover-editor/');
    await page.getByTestId('adventure-folder').setInputFiles(
      'tests/fixtures/editor-v3-invalid-roster',
    );
    const queue = page.getByRole('alertdialog', { name: 'Saneamiento obligatorio del mapa' });
    await expect(queue).toContainText('al menos 5 assets Pokémon', { timeout: 20_000 });
    await expect(queue.getByRole('region', { name: 'Reparto del sector' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Asistente de creación' })).toHaveCount(0);
  });
});
