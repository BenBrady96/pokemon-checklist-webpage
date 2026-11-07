export const CURATED_TCGDEX = { '30th-celebration': '30th' };

export const curatedLocalId = (slug, id) => {
  if (slug !== '30th-celebration') return id;
  const main = /^m(\d+)$/.exec(id);
  return main ? main[1] : id;
};

export const SPECIES_FIX = { 412: 'Burmy', 892: 'Urshifu', 898: 'Calyrex', 901: 'Ursaluna', 1017: 'Ogerpon' };

export const DEX_FIX = { 'ecard3-47': [], 'me06-100': [] };

const team = (name, pattern) => ({ name, match: new RegExp(pattern) });

export const TRAINERS = [
  'Misty', 'Brock', 'Erika', 'Sabrina', 'Blaine', 'Lt. Surge', 'Koga', 'Giovanni', 'Red', 'Blue', 'Lance', 'Bill', 'Professor Oak', 'Ash',
  'Ethan', 'Professor Elm', 'Whitney', 'Morty', 'Jasmine', 'Karen',
  'Steven', 'Wallace', 'Maxie', 'Archie', 'Winona', 'Flannery', 'Roxanne', 'Norman', 'Professor Birch',
  'Cynthia', 'Cyrus', 'Dawn', 'Barry', 'Volkner', 'Gardenia', 'Candice', 'Professor Rowan',
  'N', 'Ghetsis', 'Hilda', 'Iris', 'Colress', 'Elesa', 'Skyla', 'Caitlin', 'Bianca', 'Cheren', 'Professor Juniper',
  'Serena', 'Lysandre', 'Korrina', 'Clemont', 'Diantha', 'Shauna', 'Professor Sycamore',
  'Lillie', 'Hau', 'Gladion', 'Lusamine', 'Guzma', 'Acerola', 'Mallow', 'Lana', 'Kiawe', 'Sophocles', 'Professor Kukui',
  'Marnie', 'Hop', 'Bede', 'Leon', 'Raihan', 'Nessa', 'Piers', 'Sonia', 'Klara', 'Avery', 'Melony', 'Gordie', 'Peonia', 'Rose',
  'Iono', 'Nemona', 'Arven', 'Penny', 'Larry', 'Geeta', 'Rika', 'Poppy', 'Hassel', 'Kieran', 'Carmine', 'Lacey', 'Briar', 'Perrin', 'Professor Sada', 'Professor Turo',
  'Roseanne',
].map((name) => ({ name }));

export const GROUPS = [
  { name: 'Eeveelutions', dex: [133, 134, 135, 136, 196, 197, 470, 471, 700] },
  { name: 'Pikachu family', dex: [172, 25, 26] },
  { name: 'Kanto starters', dex: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: 'Legendary birds', dex: [144, 145, 146] },
  { name: 'Legendary beasts', dex: [243, 244, 245] },
  { name: 'Weather trio', dex: [382, 383, 384] },
  { name: 'Lake guardians', dex: [480, 481, 482] },
  { name: 'Creation trio', dex: [483, 484, 487] },
  { name: 'Tao trio', dex: [643, 644, 646] },
  { name: 'Swords of Justice', dex: [638, 639, 640, 647] },
  { name: 'Aura trio', dex: [716, 717, 718] },
  { name: 'Tapu guardians', dex: [785, 786, 787, 788] },
  { name: 'Ultra Beasts', dex: [793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806] },
  { name: 'Legendary titans', dex: [377, 378, 379, 486, 894, 895] },
  { name: 'Paradox Pokémon', dex: [984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1007, 1008, 1009, 1010, 1020, 1021, 1022, 1023] },
  team('Team Rocket', "^(?:Team )?Rocket(?:'s\\b|$| )"),
  team('Team Magma', '\\bTeam Magma\\b'),
  team('Team Aqua', '\\bTeam Aqua\\b'),
  team('Team Galactic', '\\bTeam Galactic\\b'),
  team('Team Plasma', '\\bTeam Plasma\\b'),
  team('Team Flare', '\\bTeam Flare\\b'),
  team('Team Skull', '\\bTeam Skull\\b'),
  team('Team Yell', '\\bTeam Yell\\b'),
  team('Team Star', '\\bTeam Star\\b'),
];
