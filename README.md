# Binder Tracker

Free, unofficial checklists for Pokémon TCG sets: every **Scarlet & Violet** and **Mega Evolution** expansion, their Black Star promos and Basic Energy, and a hand-curated **30th Celebration** (the site started as a checklist for that set alone). Each set has its own page in colours that match the set, with card images, rarities, copy counts, binder pages and TCGplayer prices. Other trading card games can be added later.

It is a static site built with plain HTML, CSS and JavaScript. There is no backend: each visitor's collection is saved in their own browser (`localStorage`).

**Live site:** <https://benbrady96.github.io/pokemon-checklist-webpage/>

## What collectors can do

- **Pick what they're collecting**, per set:

  | Tier | What's in it |
  |---|---|
  | Standard | The main set (001 to the printed total) |
  | Complete | Every card, including secret rares |
  | Master | Every card plus each reverse holo and pattern (Poké Ball, Master Ball, Energy Symbol and so on) |
  | Grand Master | Every card plus its special prints: prerelease and other stamps, Cosmos Holo blister cards, Play! Pokémon Prize Pack prints and other product exclusives (for 30th Celebration, its curated promos and alternate prints) |

  Tiers that would add nothing are hidden: 30th Celebration has no reverse holos, so it shows Standard 128 / Master 199 / Grand Master 246, and the promo lists show just Master and Grand Master.
- **Views:** grid (S/M/L), list, or binder pages (4, 9 or 12 pockets), with or without images.
- **Marking many cards at once:** tap, press-and-drag, shift-click, section menus, and **Quick add** (`1-22, 55x2, R12`; each set's help lists its codes). Everything can be undone.
- **Copy counts, a Duplicates filter and trade lists; search, filters and sorting.**
- **Card viewer** with a holo tilt, and a **card info** panel: where to get the card, pull odds (30th Celebration), and its price with TCGplayer and eBay UK links.
- **Stats:** progress by section and rarity, collection value and cost to complete.
- **Share and sync:** a link and QR code for one set; **Export backup** gives a code or file covering every set you've started.
- **Works offline** and installs to the home screen. Light and dark themes, keyboard shortcuts (`?`), screen-reader labels and reduced-motion support.

## Running locally

```sh
npm install      # sharp, used only by the image script
npm run dev      # http://localhost:8080 (PORT=… to change)
```

Set pages are rendered from a template, so use `npm run dev` rather than a plain static server. It renders pages on each request, so edits show on reload; restart it after changing `collections/pokemon/sets.mjs`. `npm run build` produces exactly what gets deployed, in `dist/`.

`npm test` checks every collection's data: tiers, quick-add codes, missing images, that old share links still decode, and that no card has changed position since the last commit (see [Sync codes](#sync-codes)).

## Adding a set

1. Add an entry to `collections/pokemon/sets.mjs`:

   ```js
   { slug: 'delta-reign', tcgdex: 'me06', series: MEGA, syncKey: 'DLR', tcgplayer: [24831], theme: { accent: '#…', chrome: '#…' } },
   ```

   - `tcgdex`: the set's id on [TCGdex](https://tcgdex.dev) (`https://api.tcgdex.net/v2/en/series/me` lists them).
   - `tcgplayer`: its TCGplayer group id(s), from `https://tcgcsv.com/tcgplayer/3/groups`.
   - `syncKey`: a short unique code, usually the set's official abbreviation. It goes into share links, so **never change it** once the set is live.
   - `gallery` (optional): `path/CODE` of the set on the official Pokémon TCG gallery CDN, for 660px images (for example `surging-sparks/SV08`). Without it, images come from TCGdex.
   - `theme`: two colours picked from the set's logo and packs. `accent` is for buttons and highlights, `chrome` for the dark header. `tools/lib/theme.mjs` derives the rest of the palette for light and dark mode and adjusts text colours to pass WCAG AA contrast.
   - `kind: 'promo'` or `'energy'` for promo and energy lists, with a `name`.
   - `images` (optional): `{ cardId: url }` for cards that none of the usual sources has an image for yet. These URLs are tried first.
2. Run:

   ```sh
   npm run sets -- --only delta-reign     # card list → data/pokemon/delta-reign/cards.json
   npm run images -- --only delta-reign   # images, logo and share image
   npm run prices                         # prices for every set
   npm test
   ```

3. Check the page with `npm run dev`, then commit `data/`, `img/` and the config.

The home page lists every collection from `data/catalog.json`, which `npm run sets` and `npm run images` rebuild.

### Where the data comes from

| | Source |
|---|---|
| Card lists, rarities, set logos | [TCGdex](https://tcgdex.dev), a free and open card database (responses are cached in `.cache/`) |
| Which reverse holos and patterns exist | TCGplayer's catalogue via [tcgcsv.com](https://tcgcsv.com): a "Reverse Holofoil" price on a card's product, or a separate product such as "Card (Poke Ball Pattern)" |
| Special prints (Grand Master) | TCGdex's list of each card's printings (stamps such as Prerelease, Play! Pokémon or Pokémon Center, and foils such as Cosmos Holo), plus products in the set's TCGplayer group named with a suffix such as "(Prerelease)" or "(Cosmos Holo)". Award cards (staff, judge and placement stamps) and jumbo cards are left out. Prices come from whichever TCGplayer group lists the print |
| Card images, best first | The official Pokémon TCG gallery CDN (660px), TCGdex (600px), Limitless TCG (460px), then TCGplayer's listing photo. Two ME Black Star Promos (MEP 120 Celebratory Fanfare and Pikachu at the Museum) use images from [TCG Collector](https://www.tcgcollector.com), set with `images` |
| Prices | TCGplayer market prices via tcgcsv.com, refreshed daily |

**30th Celebration** is curated by hand in `collections/pokemon/30th-celebration.mjs`, including its promos, pull odds, product notes, image sources and price matching.

## Card images and the size budget

Images are downloaded at build time and served from the site, as WebP in `img/cards/<game>/<set>/sm/` (330×460, used in the grid) and `lg/` (660×920, used in the viewer). Reverse holos, patterns and special prints use their base card's image with a label. A card only gets an image once it has an entry in `data/<game>/<set>/images.json`; until then a number-and-name placeholder is shown.

Everything comes to roughly 600 MB. GitHub Pages won't publish a site over 1 GB, so `npm run build` warns at 800 MB and stops at 950 MB. Past that point, card images need another host: each collection's image path is set in one place (`imageBase` in `js/collection.js`), so that's a small change.

`npm run images` only downloads images that are missing. Avoid `--force` for committed images: each regeneration adds a full copy to the git history.

Other options:

- `npm run images`: `--skip-icons` and `--skip-og` leave the site icons or share images alone, and `--force-og` rebuilds the generated share images (30th Celebration's is hand-made and kept).
- `npm run sets -- --refresh` ignores the download cache in `.cache/`.
- `npm run build -- --sizes` lists the card image folders by size.

## Deploying (GitHub Pages)

Deployment is automatic. `.github/workflows/deploy.yml` builds and publishes the site every time you push to `main`, and every morning at 05:30 UTC to refresh prices. In repository **Settings → Pages**, **Source** must be **GitHub Actions**. GitHub switches scheduled workflows off after 60 days without activity in a public repository. If that happens, re-enable it from the **Actions** tab.

The workflow:

- runs `npm run prices` (if that fails, the committed prices are used);
- runs `npm test`;
- runs `npm run build` (`tools/build.mjs`, no dependencies), which:
  - copies the public files into `dist/`;
  - renders the home page, one page per set (`dist/pokemon/<set>/index.html`) and `sitemap.xml`;
  - sets the real site URL in the SEO tags;
  - stamps the service worker with the commit ID;
- publishes `dist/`.

The build fails if a JS, CSS or HTML file is missing from the offline file list in `sw.js`. Set pages and `data/` are excluded from that check because they're cached on first visit.

## Storage, sync codes and backups

### Storage

| Key | Contents |
|---|---|
| `bt:v1:prefs` | Site-wide preferences, plus `tiers: { collectionId: tier }` |
| `bt:v1:c:<collectionId>` | `{ v, q: { cardId: copies }, updated, summary }`. The summary (`tier`, `owned`, `total`) is what the home page shows |

Before the rename the site stored 30th Celebration under `p30c:v1` and `p30c:prefs:v1`. Those are copied across once and left in place.

### Sync codes

Each card has an `idx`: its permanent position in share links and sync codes. `npm run sets` keeps the `idx` of every card already in a collection and appends new cards, and `npm test` fails if a card's `idx` changes.

A **v2 code** is base64url: `[2] [key length] [syncKey] [varint n] [bitset of n cards]`, then `[varint idx] [copies]` for each card with 2+ copies. Share links hold one collection (`pokemon/<set>/#sync=…`). An **Export backup** code joins one code per collection with `.`, and the backup file is `{ app: 'binder-tracker', version: 2, collections: { id: { cards } } }`.

Old **v1 codes** (`[1] [n] [bitset] [idx, copies]…`, 30th Celebration only) and old backup files still load. Old `/#sync=` links at the site root are forwarded to the 30th Celebration page.

## Prices

`npm run prices` (`tools/build-prices.mjs`, no dependencies) writes `data/<game>/<set>/prices.json` with each card's TCGplayer **market price** in US dollars: the holofoil or normal printing, or the Reverse Holofoil price for a reverse holo. It also saves the day's USD→GBP rate (frankfurter.dev, with open.er-api.com as a fallback). If a card hasn't sold, the lowest listing is kept and shown as "listed from". A collection keeps its previous file if fewer than 70% of its cards get a price, so a broken download can't wipe prices. The info panel, list view and Statistics show `≈ £` figures with the dollar price alongside.

## Project structure

```
index.html                     home page (set grid rendered by the build)
collection.html                template for every set page
privacy.html, terms.html, 404.html
manifest.webmanifest, sw.js, robots.txt
css/styles.css                 all styles; theme colours are CSS variables
js/main.js                     set page entry: loads the collection, then app.js
js/collection.js               loads a collection's data (cards, images, prices)
js/model.js                    turns collection data into the model the app uses (tiers, groups, labels)
js/games/pokemon.js            Pokémon rules: rarities and their icons, energy types, price links
js/app.js                      set page wiring
js/home.js                     home page
js/store.js, js/storage.js     collection, undo/redo, preferences, storage keys and migration
js/codec.js, js/sync.js        sync codes and backups; share, QR and import dialogs
js/transfer.js                 backups and imports that cover several sets
js/render.js, gestures.js, viewer.js, info.js, stats.js, quickadd.js, pricing.js, pwa.js, ui.js, confetti.js
js/vendor/qrcode.js            QR code generator (MIT, Kazuhiko Arase)
collections/pokemon/           build-time config: sets.mjs (every collection) and the curated 30th Celebration
data/                          generated and committed: catalog.json, and per set cards/images/prices JSON
img/cards/, img/sets/, img/og/ card images, set logos, share images
tools/                         build-sets, build-images, build-prices, build, dev, check; lib/ holds shared code
```

Everything specific to Pokémon lives in `js/games/pokemon.js` and the build tools' TCGdex/TCGplayer sources. A new game needs an adapter module, a data source and a config file; the pages and app don't change.

## Privacy

The site sets no cookies, has no analytics or trackers, and loads nothing from third-party servers: card images and prices are downloaded at build time and served with the site. The TCGplayer and eBay buttons are ordinary links. Details are in `privacy.html` and `terms.html`. If you ever add analytics, update `privacy.html` first; anything that sets cookies needs a consent banner under UK/EU law.

## Licence

The code is released under the MIT Licence (see [LICENSE](LICENSE)). It doesn't cover the Pokémon card images, names and logos, which belong to their owners; the Outfit font (SIL Open Font License, [fonts/OFL.txt](fonts/OFL.txt)); or `js/vendor/qrcode.js`, which has its own MIT licence (© Kazuhiko Arase).

## Legal

This is an unofficial fan project. It is not affiliated with, endorsed, sponsored or approved by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company. Pokémon and all card images are © Pokémon / Nintendo / Creatures Inc. / GAME FREAK inc.
