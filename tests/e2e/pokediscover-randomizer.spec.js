import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    path: 'public/assets/sprites/pokemon/pmd/0019-rattata/default/Idle-Anim.png',
  }));
  await page.goto('/tools/pokediscover-randomizer/');
});

test('filtra y sortea un posible hallazgo de PokeDiscover', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Pokémon aleatorio' })).toBeVisible();
  await expect(page.getByText('1211 candidatos posibles')).toBeVisible();

  await page.getByRole('combobox', { name: 'Tipo principal' }).selectOption('grass');
  await page.getByRole('combobox', { name: 'Tipo secundario' }).selectOption('poison');
  await page.getByRole('combobox', { name: 'Generación' }).selectOption('1');
  await page.getByRole('combobox', { name: 'Tamaño' }).selectOption('small');
  await page.getByRole('button', { name: 'Randomizar' }).click();

  const result = page.getByTestId('randomizer-result');
  await expect(result.getByText('Planta')).toBeVisible();
  await expect(result.getByText('Veneno')).toBeVisible();
  await expect(result.getByText('1', { exact: true })).toBeVisible();
  await expect(result.getByText('Pequeño')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('muestra un estado vacío y bloquea el sorteo si no hay coincidencias', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Tipo principal' }).selectOption('normal');
  await page.getByRole('combobox', { name: 'Tipo secundario' }).selectOption('normal');

  await expect(page.getByText('0 candidatos posibles')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Randomizar' })).toBeDisabled();
  await expect(page.getByText('No hay Pokémon que cumplan todos esos filtros.')).toBeVisible();
});
