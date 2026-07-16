import { loadCatalogs, validateCatalogs } from './companion-catalog-shared.mjs';

const catalogs = await loadCatalogs();
const errors = validateCatalogs(catalogs);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  const speciesCount = catalogs.reduce((total, catalog) => total + catalog.species.length, 0);
  const formCount = catalogs.reduce((total, catalog) => total + catalog.species.reduce((subtotal, species) => subtotal + species.forms.length, 0), 0);
  console.log(`Catálogo válido: ${speciesCount} especies y ${formCount} formas.`);
}
