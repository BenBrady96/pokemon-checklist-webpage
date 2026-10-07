# Binder Tracker

Free, unofficial checklists for Pokémon TCG sets: every **Scarlet & Violet** and **Mega Evolution** expansion, their Black Star promos and Basic Energy, and a hand-curated **30th Celebration** (the site started as a checklist for that set alone). Each set has its own page in colours that match the set, with card images, rarities, copy counts, binder pages and TCGplayer prices. Other trading card games can be added later.

It is a static site built with plain HTML, CSS and JavaScript. There is no backend: each visitor's collection is saved in their own browser (`localStorage`).

**Live site:** <https://benbrady96.github.io/pokemon-checklist-webpage/>

## What collectors can do

- **Pick what they're collecting**, per set:

  | Tier | What's in it |
  |---|---|
  | Standard | The main set (001 to the printed total) |
  | Master | The main set plus each reverse holo and pattern (Poké Ball, Master Ball, Energy Symbol and so on) |
  | Grand Master | Every card: the master set plus the secret rares (for 30th Celebration, the secret rares and the Classic Collection) |

  Each tier adds the next block on the page, which runs main set, reverse holos, patterns, then secret rares. Like [TCG Collector](https://www.tcgcollector.com), the lists leave out special prints (prerelease and other stamps, Cosmos Holo blister cards, Play! Pokémon Prize Pack prints and so on). Tiers that would add nothing are hidden: 30th Celebration has no reverse holos, so it shows Standard 128 / Grand Master 191, and the promo and Basic Energy lists have no tiers.
- **Views:** grid (S/M/L), list, or binder pages (4, 9 or 12 pockets), with or without images.
- **Marking many cards at once:** tap, press-and-drag, shift-click, section menus, and **Quick add** (`1-22, 55x2, R12`; each set's help lists its codes). Everything can be undone.
- **Card scanner:** point the camera at a card and the site finds the card and its set, then adds it and says whether it's a new card or a duplicate. Recognition runs on the device; see [Card scanner](#card-scanner).
- **Copy counts, a Duplicates filter and trade lists; search, filters and sorting.**
- **Card viewer** with a holo tilt, and a **card info** panel: where to get the card, pull odds (30th Celebration), and its price with TCGplayer and eBay UK links.
- **Stats:** progress by section and rarity, collection value and cost to complete.
- **Share and sync:** a link and QR code for one set; **Export backup** gives a code or file covering every set you've started.
- **Works offline** and installs to the home screen. Light and dark themes, keyboard shortcuts (`?`), screen-reader labels and reduced-motion support.

## Running locally

```sh
npm install      # sharp and onnxruntime, used only by the local build scripts
npm run dev      # http://localhost:8080 (PORT=… to change)
```

The scripts that only run on a maintainer's computer are kept out of the repository (see `.gitignore`): `tools/dev.mjs`, `tools/build-sets.mjs`, `tools/build-images.mjs`, `tools/build-scan-index.mjs`, `tools/scan-eval.mjs`, and `tools/lib/catalog.mjs`, `tcgdex.mjs` and `tcgdex-source.mjs`. So `npm run dev`, `sets`, `images`, `scan-index` and `scan-eval` need a copy of those files. Everything the deploy runs (`build`, `test`, `prices`) is in the repository.

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
   - `kind: 'promo'` or `'energy'` for promo and energy lists, with a `name`. Promo and energy lists have just their numbered cards, with no reverse holos.
   - `images` (optional): `{ cardId: url }` for cards that none of the usual sources has an image for yet. These URLs are tried first.
   - `logo` (optional): the set logo's URL, for sets TCGdex has no logo for. `logoOutline: true` gives a dark logo a white edge so it shows on the dark set tiles (the Black Star Promos use this).
   - `notes` and `details` (optional): `{ cardId: text }`. A note is shown in bold in the card's info panel and can be searched; a detail is an extra paragraph below it. ME Black Star Promos and ME Energy use them to say which 30th Celebration product a card comes from.
2. Run:

   ```sh
   npm run sets -- --only delta-reign     # card list → data/pokemon/delta-reign/cards.json
   npm run images -- --only delta-reign   # images, logo and share image
   npm run prices                         # prices for every set
   npm run scan-index                     # adds the new cards to the card scanner
   npm test
   ```

3. Check the page with `npm run dev`, then commit `data/`, `img/` and the config.

The home page lists every collection from `data/catalog.json`, which `npm run sets` and `npm run images` rebuild.

### Where the data comes from

| | Source |
|---|---|
| Card lists, rarities, set logos | [TCGdex](https://tcgdex.dev), a free and open card database (responses are cached in `.cache/`). Logos TCGdex doesn't have (30th Celebration, Temporal Forces, the promo and energy lists) come from [TCG Collector](https://www.tcgcollector.com), set with `logo` |
| Which reverse holos and patterns exist | TCGplayer's catalogue via [tcgcsv.com](https://tcgcsv.com): a "Reverse Holofoil" price on a card's product, or a separate product such as "Card (Poke Ball Pattern)" |
| Card images, best first | The official Pokémon TCG gallery CDN (660px), TCGdex (600px), Limitless TCG (460px), then TCGplayer's listing photo. Two ME Black Star Promos (MEP 120 Celebratory Fanfare and Pikachu at the Museum) use images from [TCG Collector](https://www.tcgcollector.com), set with `images` |
| Prices | TCGplayer market prices via tcgcsv.com, refreshed daily |
| Pokémon logo (home page) | The international logo from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:International_Pok%C3%A9mon_logo.svg) (public domain, a trademark of The Pokémon Company), set with `LOGO` in `collections/pokemon/sets.mjs` and saved to `img/games/` by `npm run images` |

**30th Celebration** is curated by hand in `collections/pokemon/30th-celebration.mjs`, including pull odds, product notes, image sources and price matching. Its Black Star promos and Basic Energy are listed in ME Black Star Promos and ME Energy, which take their product notes from that file.

## Card images and the size budget

Images are downloaded at build time and served from the site, as WebP in `img/cards/<game>/<set>/sm/` (330×460, used in the grid) and `lg/` (660×920, used in the viewer). Reverse holos and patterns use their base card's image with a label. A card only gets an image once it has an entry in `data/<game>/<set>/images.json`; until then a number-and-name placeholder is shown.

Everything comes to roughly 600 MB. GitHub Pages won't publish a site over 1 GB, so `npm run build` warns at 800 MB and stops at 950 MB. Past that point, card images need another host: each collection's image path is set in one place (`imageBase` in `js/collection.js`), so that's a small change.

`npm run images` only downloads images that are missing. Avoid `--force` for committed images: each regeneration adds a full copy to the git history.

Other options:

- `npm run images`: `--skip-icons` and `--skip-og` leave the site icons or share images alone, and `--force-og` rebuilds the share images (30th Celebration's uses the cards and blurb in its `og` settings).
- `npm run sets -- --refresh` ignores the download cache in `.cache/`.
- `npm run build -- --sizes` lists the card image folders by size.

## Card scanner

**Scan a card** (a camera button on the home page and set pages, and in their menus) opens the camera. The collector lines the card up in the frame and taps the button. The site shows its best matches; the collector picks the right card and its version (Regular, Reverse Holo, Poké Ball and so on), then **Add** saves one copy and says whether it's a new card or a duplicate. On a set page, cards from that set go through the page's normal undo, and cards from other sets are saved to their set straight away. **Photo** uses a picture instead of the live camera, and **Search** finds a card by name or number.

How it works:

- `data/scan/model.onnx` is DINOv2-small (Meta AI, Apache 2.0), the 8-bit version published by the Hugging Face onnx-community (24 MB, SHA-256 in `data/scan/NOTICE`). It turns a picture into 384 numbers that describe how it looks.
- `npm run scan-index` (`tools/build-scan-index.mjs`) runs one image per artwork through the model with onnxruntime-node, so reverse holos and patterns share their card's entry. It writes `data/scan/index.bin` (the numbers, as 8-bit integers) and `data/scan/index.json` (set, image, name and printed number for each row, plus the model settings). Results are cached in `.cache/scan/`, so after adding a set only its new images are processed. It also copies ONNX Runtime Web's three browser files from `node_modules` into `js/vendor/ort/`.
- In the browser, `js/scan.js` (camera and screens) and `js/scan-match.js` (matching) load only when the scanner is opened. The model and the 14 MB WebAssembly runtime download once (about 39 MB) and the service worker keeps them, keyed by version. The model's SHA-256 is checked before it's used. Each scan crops the frame, runs the model on one thread (around a second on a phone) and compares the result with every card.
- A photo can't tell a reverse holo or pattern from its card, so the collector picks the version. About 8% of artworks appear in more than one set; those matches are grouped and the collector checks the set code on the card.
- `THRESHOLD` in `tools/build-scan-index.mjs` decides when the scanner says it isn't sure. `npm run scan-eval` measures accuracy on simulated phone photos and suggests a value. For real photos, use `npm run scan-eval -- --photos scan-photos`, with files named `<set-slug>_<cardId>.jpg` (for example `surging-sparks_025.jpg`). `scan-photos/` is ignored by git.
- `npm test` fails if the index no longer matches the card lists, or if the model or runtime files don't match `index.json`.
- To update ONNX Runtime, check [GitHub's advisory database](https://github.com/advisories) first, then run `npm install --save-dev --save-exact --ignore-scripts onnxruntime-web@<version> onnxruntime-node@<version>` and `npm run scan-index`. Its install script only downloads CUDA files on Linux, so `--ignore-scripts` loses nothing on Windows or macOS.

Both page templates have a Content-Security-Policy that allows only the site's own files. `'wasm-unsafe-eval'` lets WebAssembly run, and inline styles are allowed because the pages use them for colours. The theme script that runs before the page draws is in `js/theme-init.js` rather than inline, so the policy can block inline scripts.

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

The tiers used to be Standard, Complete (with secret rares), Master (every card plus reverse holos) and Grand Master (plus special prints). Saved Complete and Master choices are switched to Grand Master once, and the prefs get `tierScheme: 2`.

30th Celebration used to list its Black Star promos and Basic Energy as well. Cards marked there are moved once to ME Black Star Promos and ME Energy, keeping the higher count if a card was marked in both. Share links and backups made before the move bring in 30th Celebration without those cards.

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
js/scan.js, scan-match.js      card scanner: camera and screens, matching (loaded only when opened)
js/scan-features.js            image maths shared by the scanner and npm run scan-index
js/theme-init.js               applies the saved theme before the page draws
js/vendor/qrcode.js            QR code generator (MIT, Kazuhiko Arase)
js/vendor/ort/                 ONNX Runtime Web (MIT, Microsoft), copied in by npm run scan-index
data/scan/                     the scanner's model (DINOv2-small, Apache 2.0) and card index
collections/pokemon/           build-time config: sets.mjs (every collection) and the curated 30th Celebration
data/                          generated and committed: catalog.json, and per set cards/images/prices JSON
img/cards/, img/sets/, img/og/ card images, set logos, share images
img/games/                     game logos for the home page
tools/                         build-sets, build-images, build-prices, build, dev, check; lib/ holds shared code
```

Everything specific to Pokémon lives in `js/games/pokemon.js` and the build tools' TCGdex/TCGplayer sources. A new game needs an adapter module, a data source and a config file; the pages and app don't change.

## Privacy

The site sets no cookies, has no analytics or trackers, and loads nothing from third-party servers: card images and prices are downloaded at build time and served with the site. The card scanner's model and runtime are served from the site too, and the camera is used only while the scanner is open; pictures are processed on the device and never uploaded or saved. The TCGplayer and eBay buttons are ordinary links. Details are in `privacy.html` and `terms.html`. If you ever add analytics, update `privacy.html` first; anything that sets cookies needs a consent banner under UK/EU law.

## Licence

The code is released under the MIT Licence (see [LICENSE](LICENSE)). It doesn't cover the Pokémon card images, names and logos, which belong to their owners; the Outfit font (SIL Open Font License, [fonts/OFL.txt](fonts/OFL.txt)); `js/vendor/qrcode.js`, which has its own MIT licence (© Kazuhiko Arase); `js/vendor/ort/`, ONNX Runtime Web (MIT, © Microsoft); or `data/scan/model.onnx`, DINOv2-small by Meta AI under the Apache License 2.0 (see `data/scan/LICENSE` and `NOTICE`).

## Legal

This is an unofficial fan project. It is not affiliated with, endorsed, sponsored or approved by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company. Pokémon and all card images are © Pokémon / Nintendo / Creatures Inc. / GAME FREAK inc.
