import generated from './generated-sets.json' with { type: 'json' };

export const LIVE = true;

export const ERAS = [
  { name: 'SEVENS & GO RUSH!!', anchor: 'Rise of the Duelist', from: '2020-08-06' },
  { name: 'VRAINS', anchor: 'Code of the Duelist', from: '2017-08-03' },
  { name: 'ARC-V', anchor: 'Duelist Alliance', from: '2014-08-14' },
  { name: 'ZEXAL', anchor: 'Generation Force', from: '2011-08-16' },
  { name: '5D’s', anchor: 'The Duelist Genesis', from: '2008-09-02' },
  { name: 'GX', anchor: 'The Lost Millennium', from: '2005-06-01' },
  { name: 'Duel Monsters', anchor: 'Legend of Blue Eyes White Dragon', from: '2002-01-01' },
];

export const PROMOS = 'Promos';

export const SERIES = [...ERAS.map((e) => e.name), PROMOS];

export const LOGO = 'https://upload.wikimedia.org/wikipedia/commons/2/21/Yu-Gi-Oh%21.png';

export const eraOf = (date) => ERAS.find((e) => date >= e.from)?.name || ERAS.at(-1).name;

export default generated;
