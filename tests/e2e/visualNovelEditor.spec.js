import { expect, test } from '@playwright/test';

test.describe('Editor de novela visual', () => {
  test.skip(({ viewport }) => viewport && viewport.width < 1280, 'La edición solo se ofrece en escritorio.');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const files = {
        'public/assets/adventure/narratives/manifest.v1.json': JSON.stringify({
          schemaVersion: 1,
          conversations: [{
            schemaVersion: 1,
            conversationId: 'conversation:test:intro',
            title: 'Introducción de prueba',
            tags: ['test'],
            documentPath: 'assets/adventure/narratives/intro.conversation.json',
          }],
        }),
        'public/assets/adventure/narratives/intro.conversation.json': JSON.stringify({
          schemaVersion: 1,
          conversationId: 'conversation:test:intro',
          title: 'Introducción de prueba',
          tags: ['test'],
          initialCueId: 'cue:intro',
          once: false,
          cues: [{
            cueId: 'cue:intro',
            kind: 'dialogue',
            speakerName: 'Alcanfor',
            text: 'Hola.',
            actions: [],
            outcomeId: 'completed',
          }],
        }),
        'public/assets/adventure/media/manifest.v1.json': JSON.stringify({
          schemaVersion: 1,
          assets: [],
        }),
        'public/assets/sprites/pokemon/pmd/manifest.v1.json': JSON.stringify({
          schemaVersion: 1,
          tickRate: 60,
          assets: [],
        }),
      };
      const directories = new Set(['']);
      for (const path of Object.keys(files)) {
        const parts = path.split('/');
        for (let index = 1; index < parts.length; index += 1) {
          directories.add(parts.slice(0, index).join('/'));
        }
      }
      directories.add('public/assets/adventure/maps');

      const fileHandle = path => ({
        kind: 'file',
        name: path.split('/').at(-1),
        async getFile() {
          return new File([files[path] ?? ''], this.name, { type: 'application/json' });
        },
        async createWritable() {
          let next = '';
          return {
            async write(value) {
              next = typeof value === 'string' ? value : await value.text();
            },
            async close() {
              files[path] = next;
            },
          };
        },
      });
      const directoryHandle = path => ({
        kind: 'directory',
        name: path.split('/').at(-1) || 'pokemon voice',
        async queryPermission() { return 'granted'; },
        async requestPermission() { return 'granted'; },
        async getDirectoryHandle(name, options = {}) {
          const child = [path, name].filter(Boolean).join('/');
          if (!directories.has(child) && !options.create) throw new DOMException('No existe', 'NotFoundError');
          directories.add(child);
          return directoryHandle(child);
        },
        async getFileHandle(name, options = {}) {
          const child = [path, name].filter(Boolean).join('/');
          if (!(child in files) && !options.create) throw new DOMException('No existe', 'NotFoundError');
          files[child] ??= '';
          return fileHandle(child);
        },
        async removeEntry(name) {
          delete files[[path, name].filter(Boolean).join('/')];
        },
        async *values() {
          const prefix = path ? `${path}/` : '';
          const childNames = new Set();
          for (const directory of directories) {
            if (directory.startsWith(prefix)) {
              const rest = directory.slice(prefix.length);
              if (rest && !rest.includes('/')) childNames.add(rest);
            }
          }
          for (const filePath of Object.keys(files)) {
            if (filePath.startsWith(prefix)) {
              const rest = filePath.slice(prefix.length);
              if (rest && !rest.includes('/')) childNames.add(rest);
            }
          }
          for (const name of childNames) {
            const child = [path, name].filter(Boolean).join('/');
            yield directories.has(child) ? directoryHandle(child) : fileHandle(child);
          }
        },
      });
      window.__visualNovelTestFiles = files;
      window.showDirectoryPicker = async () => directoryHandle('');
    });
  });

  test('abre la raíz, guarda, reabre y navega entre herramientas', async ({ page }) => {
    await page.goto('/tools/visual-novel-editor/');
    await expect(page.getByText('Editor de novela visual', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir pokemon voice' }).click();
    await expect(page.getByLabel('Título')).toHaveValue('Introducción de prueba');
    const saveBeforePreview = await page.evaluate(() => JSON.stringify(localStorage));
    await page.locator('.visual-novel__dialogue').click();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saveBeforePreview);

    await page.getByLabel('Título').fill('Prólogo editable');
    await expect(page.locator('.vn-editor__status')).toContainText('archivo(s) pendiente(s)');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.vn-editor__status')).toContainText('Guardado');
    expect(await page.evaluate(() => JSON.parse(
      window.__visualNovelTestFiles['public/assets/adventure/narratives/intro.conversation.json'],
    ).title)).toBe('Prólogo editable');

    await page.getByRole('button', { name: 'Abrir raíz…' }).click();
    await expect(page.getByLabel('Título')).toHaveValue('Prólogo editable');
    await expect(page.getByRole('navigation', { name: 'Herramientas PokeDiscover' }))
      .toContainText('MapasHistoriaNovela visualRandomizador');
    await page.getByLabel('Título').fill('Cambio pendiente');
    await page.getByRole('link', { name: 'Randomizador' }).click();
    const pendingDialog = page.getByRole('dialog', { name: 'Cambios pendientes' });
    await expect(pendingDialog).toBeVisible();
    await pendingDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page).toHaveURL(/\/tools\/visual-novel-editor\/$/u);
    await page.getByRole('link', { name: 'Randomizador' }).click();
    await pendingDialog.getByRole('button', { name: 'Descartar' }).click();
    await expect(page).toHaveURL(/\/tools\/pokediscover-randomizer\/$/u);
    await expect(page.getByRole('navigation', { name: 'Herramientas PokeDiscover' }))
      .toContainText('Novela visual');
  });
});
