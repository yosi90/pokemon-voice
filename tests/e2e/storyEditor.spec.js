import { expect, test } from '@playwright/test';

test.describe('Gestor global de historia', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const files = {
        'public/assets/adventure/maps/test/test.adventure.json': JSON.stringify({
          schemaVersion: 3,
          mapId: 'map:test',
          title: 'Mapa de prueba',
          sectors: [{ sectorId: 'sector:test:01', label: 'Entrada', tiledMapPath: 'test.tmj' }],
          entryPoints: [],
          missionIds: ['mission:test'],
        }),
        'public/assets/adventure/maps/test/test.missions.json': JSON.stringify({
          schemaVersion: 2,
          mapId: 'map:test',
          narrativeSequences: [],
          missions: [{
            schemaVersion: 2,
            missionId: 'mission:test',
            mapId: 'map:test',
            title: 'El recado de prueba',
            loadingText: 'Cargando',
            briefing: 'Comprueba el gestor.',
            category: 'side',
            publicationStatus: 'published',
            lockedPresentation: { kind: 'hidden' },
            objectives: [],
            rewards: [],
            unlocksFreeExpedition: false,
            abandonment: { allowed: true },
            flow: {
              schemaVersion: 2,
              initialNodeId: 'node:expedition',
              nodes: [
                { kind: 'expedition', nodeId: 'node:expedition', mapId: 'map:test', mapVariantIds: [], outcomes: { complete: 'node:success' } },
                { kind: 'terminal', nodeId: 'node:success', result: 'success' },
              ],
            },
          }],
        }),
        'public/assets/adventure/story/outline.v1.json': JSON.stringify({
          schemaVersion: 1,
          storyId: 'story:test',
          title: 'Historia de prueba',
          acts: [{
            schemaVersion: 1,
            actId: 'act:01',
            title: 'Acto I',
            chapters: [{ schemaVersion: 1, chapterId: 'chapter:01', title: 'Capítulo 1', missionIds: ['mission:test'] }],
          }],
          missionPositions: {},
          flowNodePositions: {},
        }),
        'public/assets/adventure/missions/manifest.v1.json': JSON.stringify({ schemaVersion: 2, missions: [] }),
      };
      const directories = new Set(['']);
      for (const path of Object.keys(files)) {
        const parts = path.split('/');
        for (let index = 1; index < parts.length; index += 1) directories.add(parts.slice(0, index).join('/'));
      }
      const fileHandle = path => ({
        kind: 'file',
        name: path.split('/').at(-1),
        async getFile() { return new File([files[path] ?? ''], this.name, { type: 'application/json' }); },
        async createWritable() {
          let next = '';
          return {
            async write(value) { next = typeof value === 'string' ? value : await value.text(); },
            async close() { files[path] = next; },
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
        async removeEntry(name) { delete files[[path, name].filter(Boolean).join('/')]; },
        async *values() {
          const prefix = path ? `${path}/` : '';
          const children = new Set();
          for (const directory of directories) {
            const rest = directory.startsWith(prefix) ? directory.slice(prefix.length) : '';
            if (rest && !rest.includes('/')) children.add(rest);
          }
          for (const filePath of Object.keys(files)) {
            const rest = filePath.startsWith(prefix) ? filePath.slice(prefix.length) : '';
            if (rest && !rest.includes('/')) children.add(rest);
          }
          for (const child of children) {
            const childPath = [path, child].filter(Boolean).join('/');
            yield directories.has(childPath) ? directoryHandle(childPath) : fileHandle(childPath);
          }
        },
      });
      window.showDirectoryPicker = async () => directoryHandle('');
    });
    await page.goto('/tools/story-editor/');
  });

  test('abre la raíz y sincroniza biblioteca, timeline y flujo', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Gestor de historia' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir pokemon voice' }).click();
    const missionButton = page.getByRole('button', { name: 'published El recado de prueba Mapa de prueba', exact: true });
    await expect(missionButton).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Actos y capítulos' })).toBeVisible();
    await missionButton.click();
    await page.getByRole('button', { name: 'Flujo de misión' }).click();
    await expect(page.locator('.story-flow__timeline').getByText('Expedición · Mapa de prueba', { exact: true })).toBeVisible();
    await expect(page.getByText('Simulación aislada', { exact: true })).toBeVisible();
  });
});
