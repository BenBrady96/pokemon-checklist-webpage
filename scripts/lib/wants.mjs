export const plainText = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

export const foldName = (s) => plainText(s).toLowerCase().replace(/:/g, ' ').replace(/\s+/g, ' ').trim();

export const wantsName = (name) => plainText(String(name).replace(/\[([^\]]*)\]/g, (_, inner) => ` ${inner.split('|').map((s) => s.trim()).filter(Boolean).join(' ')} `));

export const pasteable = (name) => !/[()]/.test(name);

const bare = (s) => plainText(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^basic /, '');

const firstWord = (s) => bare(s).split(/[^a-z0-9']+/).find(Boolean) || '';

const compact = (s) => bare(String(s).replace(/\s*\[[^\]]*\]/g, '')).replace(/[^a-z0-9]/g, '');

export const sameCard = (cardName, productName) => firstWord(cardName) === firstWord(productName) || compact(cardName) === compact(productName);

export function nameCandidates(name) {
  const plain = plainText(name);
  const deck = /^(.+) Structure Deck$/.exec(plain);
  return [...new Set([plain, plain.replace(/\s*\([^)]*\)$/, ''), deck && `Structure Deck: ${deck[1]}`].filter(Boolean))];
}

export function sealedPrefixes(names) {
  const out = new Map();
  for (const raw of names) {
    const text = plainText(raw);
    const seen = new Set();
    for (let i = 1; i <= text.length; i++) {
      if (i < text.length && !/[\s:,]/.test(text[i])) continue;
      const head = text.slice(0, i).replace(/[\s:,]+$/, '');
      const key = foldName(head);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const clean = !/^\s*\(/.test(text.slice(i));
      const hit = out.get(key);
      if (!hit) out.set(key, { text: head, count: 1, clean });
      else {
        hit.count++;
        if (clean && !hit.clean) Object.assign(hit, { text: head, clean });
      }
    }
  }
  return out;
}

export const primaryExpansion = (set) => [...set.expansions].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

export function resolveExpansions({ sets, sealed, overrides = {} }) {
  const candidates = sets.flatMap((s) => nameCandidates(s.name).map((name, rank) => ({ set: s.id, key: foldName(name), rank })));
  const beats = (c, best, own, prefixes) => {
    const covers = prefixes.get(c.key).count - prefixes.get(best.key).count;
    if (covers) return covers > 0;
    if (c.key.length !== best.key.length) return c.key.length > best.key.length;
    if (c.rank !== best.rank) return c.rank < best.rank;
    return own.has(c.set) && !own.has(best.set);
  };
  const owners = new Map();
  for (const s of sets) {
    for (const exp of s.expansions.keys()) {
      if (!owners.has(exp)) owners.set(exp, new Set());
      owners.get(exp).add(s.id);
    }
  }
  const out = new Map();
  for (const s of sets) {
    const name = overrides[s.id];
    const primary = primaryExpansion(s);
    if (name && primary != null) out.set(primary, { name: plainText(name), set: s.id, override: true });
  }
  for (const [exp, own] of owners) {
    if (out.has(exp)) continue;
    const prefixes = sealedPrefixes(sealed.get(exp) || []);
    let best = null;
    for (const c of candidates) {
      if (!prefixes.has(c.key)) continue;
      if (!best || beats(c, best, own, prefixes)) best = c;
    }
    const hit = best && prefixes.get(best.key);
    if (hit?.clean && own.has(best.set) && pasteable(hit.text)) out.set(exp, { name: hit.text, set: best.set });
  }
  return out;
}

export function indexProducts(products) {
  const byId = new Map();
  const first = new Map();
  for (const p of products) {
    byId.set(p.idProduct, p);
    const key = `${p.idExpansion}|${p.name}`;
    if (!first.has(key) || p.idProduct < first.get(key)) first.set(key, p.idProduct);
  }
  return { byId, first };
}

export const productFor = (card, index) => {
  const p = card.cm ? index.byId.get(card.cm) : null;
  return p && sameCard(card.name, p.name) ? p : null;
};

export function sharedProducts(cards) {
  const seen = new Map();
  for (const c of cards) if (c.cm && !c.cmFoil) seen.set(c.cm, (seen.get(c.cm) || 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([cm]) => cm));
}

export function lineForCard(card, index, expansions) {
  const p = productFor(card, index);
  if (!p || !pasteable(p.name)) return null;
  const exp = expansions.get(p.idExpansion);
  if (!exp || !pasteable(exp.name) || index.first.get(`${p.idExpansion}|${p.name}`) !== p.idProduct) return null;
  return `${wantsName(p.name)} (${exp.name})`;
}

export function nameIndex(products) {
  const out = new Map();
  for (const p of products) {
    const key = foldName(p.name);
    if (!out.has(key)) out.set(key, new Map());
    const byExp = out.get(key);
    if (!byExp.has(p.idExpansion)) byExp.set(p.idExpansion, p.name);
  }
  return out;
}

export function overlapExpansions(cardNames, byName, { share = 0.6 } = {}) {
  const names = [...new Set(cardNames.map(foldName))];
  const counts = new Map();
  for (const name of names) {
    for (const exp of byName.get(name)?.keys() || []) counts.set(exp, (counts.get(exp) || 0) + 1);
  }
  const floor = Math.max(1, names.length * share);
  return new Map([...counts].filter(([, n]) => n >= floor).sort((a, b) => b[1] - a[1] || a[0] - b[0]));
}

export function nameLines(cards, byName, exp) {
  if (!pasteable(exp.name)) return {};
  const seen = new Map();
  for (const c of cards) seen.set(foldName(c.name), (seen.get(foldName(c.name)) || 0) + 1);
  const lines = {};
  for (const c of cards) {
    const key = foldName(c.name);
    const productName = seen.get(key) === 1 ? byName.get(key)?.get(exp.id) : null;
    if (productName && pasteable(productName)) lines[c.id] = `${plainText(productName)} (${exp.name})`;
  }
  return lines;
}
