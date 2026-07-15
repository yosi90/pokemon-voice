export const pokemonCatalogFixture = {
  count: 10,
  next: null,
  previous: null,
  results: [
    { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon/1/' },
    { name: 'ivysaur', url: 'https://pokeapi.co/api/v2/pokemon/2/' },
    { name: 'venusaur', url: 'https://pokeapi.co/api/v2/pokemon/3/' },
    { name: 'charmander', url: 'https://pokeapi.co/api/v2/pokemon/4/' },
    { name: 'squirtle', url: 'https://pokeapi.co/api/v2/pokemon/7/' },
    { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon/25/' },
    { name: 'eevee', url: 'https://pokeapi.co/api/v2/pokemon/133/' },
    { name: 'mew', url: 'https://pokeapi.co/api/v2/pokemon/151/' },
    { name: 'chikorita', url: 'https://pokeapi.co/api/v2/pokemon/152/' },
    { name: 'sprigatito', url: 'https://pokeapi.co/api/v2/pokemon/906/' },
  ],
};

const generationNameForId = id => {
  if (id <= 151) return 'generation-i';
  if (id <= 251) return 'generation-ii';
  return 'generation-ix';
};

export async function mockPokemonApi(page) {
  await page.route('https://pokeapi.co/api/v2/**', route => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/v2/pokemon') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(pokemonCatalogFixture) });
    }

    const pokemonMatch = url.pathname.match(/^\/api\/v2\/pokemon\/(\d+)\/?$/);
    if (pokemonMatch) {
      const id = Number(pokemonMatch[1]);
      const pokemon = pokemonCatalogFixture.results.find(entry => entry.url.endsWith(`/pokemon/${id}/`));
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: pokemon?.name || `pokemon-${id}`,
          types: [],
          species: { url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
        }),
      });
    }

    const speciesMatch = url.pathname.match(/^\/api\/v2\/pokemon-species\/(\d+)\/?$/);
    if (speciesMatch) {
      const id = Number(speciesMatch[1]);
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          name: pokemonCatalogFixture.results.find(entry => entry.url.endsWith(`/pokemon/${id}/`))?.name,
          generation: { name: generationNameForId(id) },
          is_legendary: false,
          is_mythical: id === 151,
        }),
      });
    }

    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}
