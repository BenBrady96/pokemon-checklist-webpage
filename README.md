# 30th Celebration Card Checklist

An unofficial, mobile-friendly checklist for the **Pokémon TCG: 30th Celebration** set (2026). It tracks all 196 cards: the 158-card main set including secret rares, the 30-card Classic Collection, and the 8 Basic Energy cards. You can track copy counts as well as owned/missing.

It is a static site built with plain HTML, CSS and JavaScript. There is no backend: each visitor's collection is saved in their own browser (`localStorage`).

**Live site:** <https://benbrady96.github.io/pokemon-checklist-webpage/>

## Features

- **Views:** grid (S/M/L), list, or binder pages (4, 9 or 12 pockets). Card images can be turned on or off in any view.
- **Marking many cards at once:**
  - Tap or click a card to mark it.
  - On a phone, press and hold a card and then drag across others. With a mouse, click and drag.
  - Shift-click marks a range.
  - Section menus and "mark all shown" work with the current search and filters.
  - **Quick add** takes card numbers: `1-22, 55x2, C1-C5, E9-E16`.
  - Everything can be undone.
- **Copy counts:** *Count* mode makes each tap add a copy. There is a Duplicates filter and a copyable trade list.
- **Search and filters:** search by name, number or rarity; filter by status, rarity and section; sort by set order, name or rarity.
- **Card viewer:** large art with a holo tilt, and swipe or arrow-key browsing.
- **Stats:** progress by section and rarity.
- **Share and sync:** a link and QR code containing the whole collection. Open it on another device to merge or replace, or send it to a friend to view.
- **Backups:** export and import a JSON file.
- **Works offline:** it can be installed to the home screen (PWA).
- Light and dark themes, keyboard shortcuts (`?`), screen-reader labels and reduced-motion support.

## Deploying (GitHub Pages)

Deployment is automatic. `.github/workflows/deploy.yml` builds and publishes the site every time you push to `main`.

One-time setup:

1. Push this folder to a GitHub repository named `pokemon-checklist-webpage`.
2. In the repository, go to **Settings → Pages → Build and deployment**, and set **Source** to **GitHub Actions**.
3. Push to `main`, or run the workflow by hand from the **Actions** tab. The site goes live at `https://benbrady96.github.io/pokemon-checklist-webpage/`.

What the workflow does:

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

The site sets no cookies, has no analytics or trackers, and loads nothing from third-party servers. That's why there's no cookie banner. Details are in `privacy.html` (privacy and cookie policy) and `terms.html` (terms of use).

If you ever add analytics, update `privacy.html` first. Anything that sets cookies needs a consent banner under UK/EU law.

## Card images

Images live in `img/cards/sm/` (330×460, used in the grid) and `img/cards/lg/` (660×920, used in the viewer) as WebP files. They were generated from the official gallery at <https://tcg.pokemon.com/en-us/galleries/30th-celebration/>. The gallery doesn't include the Basic Energy cards, so those are downloaded from separate URLs listed in the script.

To regenerate the images, icons and share image (Node 18+):

```sh
npm install      # installs sharp, used only by this script
npm run images   # downloads missing cards; `npm run images:force` redoes everything
```

The official gallery numbers the Classic Collection in a different order from the checklist, and `tools/build-images.mjs` maps between the two (`CLASSIC_IMAGE`).

If you replace existing card images, change `IMAGE_CACHE` in `sw.js` so returning visitors don't keep old copies.

## Card data

`js/cards.js` lists every card in official checklist order. The order also defines each card's position in share links, so **only ever append** new cards.

Collections are stored under the `localStorage` key `p30c:v1` as `{ "q": { "m001": 2, "c05": 1, … } }`. The id prefixes are `m` = main set and secret rares, `c` = Classic Collection, and `e` = Basic Energy.

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
js/stats.js              statistics and trade lists
js/quickadd.js           number-entry parser
js/sync.js               share links, QR codes, backups
js/ui.js, js/pwa.js, js/confetti.js
js/vendor/qrcode.js      QR code generator (MIT, Kazuhiko Arase)
fonts/                   Outfit (SIL Open Font License)
img/                     card images, icons, share image
tools/build.mjs          deploy build (no dependencies)
tools/build-images.mjs   image download and conversion
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
