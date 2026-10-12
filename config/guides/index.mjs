import fakePokemonCards from './fake-pokemon-cards.mjs';

export const GUIDES = [fakePokemonCards].map((guide) => ({ ...guide, id: `guides/${guide.slug}` }));
