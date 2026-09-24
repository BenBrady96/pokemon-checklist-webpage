# 30th Celebration Card Checklist

An unofficial, mobile-friendly checklist for the **Pokémon TCG: 30th Celebration** set (2026). It tracks all 199 cards: the 158-card numbered set including secret rares, the 3 RGB Mews, the 30-card Classic Collection and the 8 Basic Energy cards. You can track copy counts as well as owned/missing.

Collectors pick what they're going for:

| Set | Cards | What's in it |
|---|---|---|
| Standard | 128 | Main Set 001–128, including the 30 Pikachu Rares |
| Master (default) | 199 | Everything in the set: adds secret rares 129–158, the RGB Mews, the Classic Collection and Basic Energy |
| Grand Master | 246 | Adds the 17 Black Star promos (MEP 094–110) from 30th Celebration products, the 27 First Partner Illustration promos (MEP 037–063) released for the 30th anniversary, and 3 stamped or alternate prints: Mewtwo 063 with the "What's Your Favorite?" stamp, the Cosmos Holo Eevee 116 and the Pokémon Center-stamped Nidorina |

The set has no reverse holos (every card is foil), and Jumbo cards are left out.

It is a static site built with plain HTML, CSS and JavaScript. There is no backend: each visitor's collection is saved in their own browser (`localStorage`).

**Live site:** <https://benbrady96.github.io/pokemon-checklist-webpage/>

## Features

- **Standard, Master or Grand Master:** a picker above the cards chooses the set you're collecting. Progress, stats, binder pages and the missing list all follow it, and cards you've marked are kept when you switch.
- **Views:** grid (S/M/L), list, or binder pages (4, 9 or 12 pockets). Card images can be turned on or off in any view.
- **Marking many cards at once:**
  - Tap or click a card to mark it.
  - On a phone, press and hold a card and then drag across others. With a mouse, click and drag.
  - Shift-click marks a range.
  - Section menus and "mark all shown" work with the current search and filters.
  - **Quick add** takes card numbers: `1-22, 55x2, C1-C5, E9-E16`. `RGB` adds the three RGB Mews (`R/RGB`, `G/RGB`, `B/RGB` for one), `P37-P63` and `P94-P110` are the promos and `V1-V3` the variants.
  - Everything can be undone.
- **Copy counts:** *Count* mode makes each tap add a copy. There is a Duplicates filter and a copyable trade list.
- **Search and filters:** search by name, number or rarity; filter by status, rarity and section; sort by set order, name or rarity.
- **Card viewer:** large art with a holo tilt, and swipe or arrow-key browsing.
- **Card info:** the ⓘ button on a card (or the `I` key) shows:
  - where to get the card;
  - rough pull odds for booster-pack cards;
  - its market price in £ and $, with links to TCGplayer and eBay UK sold listings.
- **Prices:** TCGplayer market prices, refreshed daily. The list view shows each card's price.
- **Stats:** progress by section and rarity, plus collection value and cost to complete.
- **Share and sync:** a link and QR code containing the whole collection. Open it on another device to merge or replace, or send it to a friend to view.
- **Backups:** *Export backup* gives you a sync code to copy or a JSON file to save. *Import backup* takes the code, a pasted sync link or the file. Pasting is how you move a collection into an iPhone or iPad Home Screen app: the app keeps its own storage, separate from Safari's, and links always open in Safari.
- **Works offline:** it can be installed to the home screen (PWA).
- Light and dark themes, keyboard shortcuts (`?`), screen-reader labels and reduced-motion support.

## Deploying (GitHub Pages)

Deployment is automatic. `.github/workflows/deploy.yml` builds and publishes the site every time you push to `main`.

One-time setup:

1. Push this folder to a GitHub repository named `pokemon-checklist-webpage`.
2. In the repository, go to **Settings → Pages → Build and deployment**, and set **Source** to **GitHub Actions**.
3. Push to `main`, or run the workflow by hand from the **Actions** tab. The site goes live at `https://benbrady96.github.io/pokemon-checklist-webpage/`.

The workflow also runs every morning at 05:30 UTC to refresh card prices (see [Prices](#prices)). GitHub switches scheduled workflows off after 60 days without activity in a public repository. If that happens, re-enable it from the **Actions** tab.

What the workflow does:

- runs `npm run prices` to download the day's prices; if that fails, the build uses the copy of `js/prices.js` in the repository;
- runs `npm run build` (`tools/build.mjs`), which needs no dependencies;
- copies only the public site files into `dist/`, leaving out tools, `node_modules`, README and so on;
- sets the site URL in the SEO tags, sitemap and `robots.txt` to the real Pages URL;
- stamps the service worker with the commit ID;
- publishes `dist/`.

Because every deploy gets a new service worker version, returning visitors (including anyone who installed the app) pick up the new version automatically on their next visit. There's nothing to bump by hand.

The build also fails if a JS, CSS or HTML file is missing from the offline file list in `sw.js`, so a new file can't be deployed without offline support.

## Running locally

```sh
python -m http.server 8080      # or: npx http-server -p 8080 -c-1
```

Then open <http://localhost:8080>. The service worker needs `localhost` or HTTPS, not a `file://` URL.

To preview exactly what gets deployed, run `npm run build` and serve the `dist/` folder instead.

## Search engines and sharing

The site is set up to be indexed:

- page titles and descriptions;
- canonical URLs;
- Open Graph and Twitter tags with a share image (`img/og-image.jpg`);
- structured data (`WebSite` and `WebApplication`);
- `sitemap.xml`;
- an About section with plain text for crawlers;
- a custom `404.html`.

To get it into Google quickly:

1. Open [Google Search Console](https://search.google.com/search-console) and add a **URL prefix** property for `https://benbrady96.github.io/pokemon-checklist-webpage/`.
2. Verify with the **HTML tag** method. Add the `<meta name="google-site-verification" …>` tag it gives you to the `<head>` of `index.html`, push, then press Verify.
3. Under **Sitemaps**, submit `sitemap.xml`.

You can then use **URL inspection → Request indexing** on the home page.

For Bing, [Bing Webmaster Tools](https://www.bing.com/webmasters) can import the site straight from Search Console.

Crawlers only read `robots.txt` at the root of a domain, not inside a project folder, so here the sitemap has to be submitted by hand as above. If you later move to a custom domain, `robots.txt` starts working as-is.

## Privacy

The site sets no cookies, has no analytics or trackers, and loads nothing from third-party servers. Prices are downloaded at build time and served with the site. The TCGplayer and eBay buttons are ordinary links that open only when tapped. That's why there's no cookie banner. Details are in `privacy.html` (privacy and cookie policy) and `terms.html` (terms of use).

If you ever add analytics, update `privacy.html` first. Anything that sets cookies needs a consent banner under UK/EU law.

## Card images

Images live in `img/cards/sm/` (330×460, used in the grid) and `img/cards/lg/` (660×920, used in the viewer) as WebP files. They were generated from the official gallery at <https://tcg.pokemon.com/en-us/galleries/30th-celebration/>. The official image server doesn't have everything, so some cards come from elsewhere (all URLs are in the script):

- **Basic Energy:** separate URLs listed in the script.
- **RGB Mews:** 660×920 scans from a press gallery.
- **Black Star promos:** MEP 037–063 and 094–101 come from the Limitless TCG image server (`MEP_094_R_EN_LG.png` and so on). These are only 460×640, so they are upscaled for the viewer. Limitless didn't have MEP 102–110 yet, so those come from PokeCottage's card library (574×800).
- **Variants:** the Pokémon Center Nidorina uses PokeCottage's scan, which shows the stamp. The stamped Mewtwo and the Cosmos Holo Eevee reuse their base card's image, because no scan shows the difference. A small label on each variant says which print it is.

A card only gets an image once it has an entry in `js/card-colors.js`, which the script writes for every image it builds. A card without an entry shows a number-and-name placeholder instead of a broken image.

To regenerate the images, icons and share image (Node 18+):

```sh
npm install      # installs sharp, used only by this script
npm run images   # downloads missing cards; `npm run images:force` redoes everything
```

The official gallery numbers the Classic Collection in a different order from the checklist, and `tools/build-images.mjs` maps between the two (`CLASSIC_IMAGE`).

If you replace existing card images, change `IMAGE_CACHE` in `sw.js` so returning visitors don't keep old copies.

## Card data

`js/cards.js` lists every card. The order of the `CARDS` array also defines each card's position in share links and sync codes (a sync code is the part of the link after `#sync=`), so **only ever append** new cards. The code stores the card count in one byte, so the list can hold at most 255 cards before `js/sync.js` needs a new `VERSION`. There are 246 cards now.

Within a section, cards appear in array order, so the RGB Mews still show at the end of the Secret Rares even though they were added last.

Each section has a `tier` (`standard`, `master` or `grand`). A set includes every section at or below its tier, and `getTier()` returns that set's sections and cards.

Collections are stored under the `localStorage` key `p30c:v1` as `{ "q": { "m001": 2, "c05": 1, … } }`. The id prefixes are:

- `m`: main set and secret rares
- `rgb-`: the RGB Mews
- `c`: Classic Collection
- `e`: Basic Energy
- `p`: Black Star and First Partner promos, by MEP number
- `v`: variants, which point to their base card with `base`

The chosen set is saved with the other preferences.

## Prices

`npm run prices` (`tools/build-prices.mjs`, no dependencies) writes `js/prices.js`. It works like this:

- **Download:** it fetches four TCGplayer product groups from [tcgcsv.com](https://tcgcsv.com), which republishes TCGplayer's catalogue and prices every day: 30th Celebration, the Classic Collection, Mega Evolution Promos and Mega Evolution Energies.
- **Matching:** it matches each card by its printed number. Classic Collection cards are also matched by name, because their numbers repeat.
- **Price:** it keeps the holofoil **market price** in US dollars. If a card hasn't sold yet, it keeps the lowest listing instead, shown on the site as "listed from".
- **Exchange rate:** it saves the day's USD to GBP rate from frankfurter.dev (European Central Bank rates), with open.er-api.com as a fallback.
- **Safety check:** it refuses to overwrite the file if fewer than 200 cards end up with a price, so a broken download can't wipe the prices.

The info panel, list view and Statistics all read that file. `js/pricing.js` formats the prices, and the site shows `≈ £` figures with the dollar price alongside.

Variants without their own TCGplayer listing, currently the stamped Mewtwo and the Cosmos Holo Eevee, show "No price yet". When TCGplayer lists them, add their product IDs to `PRODUCT_OVERRIDES` in the script.

Pull odds in the info panel (`PULL_ODDS` in `js/info.js`) are rounded community estimates from early English pack openings. Update them as better data appears.

## Project structure

```
index.html               the checklist
privacy.html, terms.html legal pages
404.html                 not-found page
robots.txt, sitemap.xml  search engine files
manifest.webmanifest     install-to-home-screen settings
sw.js                    offline support
css/styles.css           all styles (light and dark themes)
js/app.js                startup and wiring
js/cards.js              card data
js/store.js              collection, preferences, undo/redo
js/render.js             grid, list and binder views
js/gestures.js           tap, drag-to-mark, shift-click, keyboard
js/viewer.js             full-screen card viewer
js/stats.js              statistics, collection value and trade lists
js/info.js               card info panel: where to get it, pull odds, price
js/pricing.js            price lookup and £/$ formatting
js/prices.js             price snapshot (generated by `npm run prices`)
js/quickadd.js           number-entry parser
js/sync.js               share links, sync codes, QR codes, backups
js/ui.js, js/pwa.js, js/confetti.js
js/vendor/qrcode.js      QR code generator (MIT, Kazuhiko Arase)
fonts/                   Outfit (SIL Open Font License)
img/                     card images, icons, share image
tools/build.mjs          deploy build (no dependencies)
tools/build-images.mjs   image download and conversion
tools/build-prices.mjs   daily price snapshot from tcgcsv.com
.github/workflows/       GitHub Pages deployment
```

## Licence

The code is released under the MIT Licence. See [LICENSE](LICENSE) for the full text.

The licence covers only the code written for this project. It does not cover:

- the Pokémon card images, names and logos, which belong to their owners (see [Legal](#legal));
- the Outfit font, which is under the SIL Open Font License ([fonts/OFL.txt](fonts/OFL.txt));
- the QR code generator in `js/vendor/qrcode.js`, which has its own MIT licence (© Kazuhiko Arase).

## Legal

This is an unofficial fan project. It is not affiliated with, endorsed, sponsored or approved by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company. Pokémon and all card images are © Pokémon / Nintendo / Creatures Inc. / GAME FREAK inc.
