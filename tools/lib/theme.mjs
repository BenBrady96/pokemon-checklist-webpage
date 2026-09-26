export const DEFAULT = {
  accent: '#F2C14E',
  chrome: '#151D4A',
  light: {
    '--theme-pale': '#FFE9A3', '--theme-hi': '#FFD978', '--theme': '#F2C14E', '--theme-lo': '#E5AA33',
    '--theme-strong': '#E0A82E', '--theme-deep': '#C98E1E', '--theme-bright': '#F7D774', '--on-theme': '#1A1F45',
    '--theme-ink': '#8A5D00',
    '--chrome-0': '#1D275C', '--chrome-1': '#151D4A', '--chrome-2': '#0D1334', '--chrome-3': '#070B1E', '--chrome-ink': '#EEF0FA',
    '--bg': '#F5F1E8', '--surface-2': '#EFEADF', '--surface-3': '#E3DCCB', '--page-bg': '#EAE3D3',
    '--text': '#141A40', '--text-2': '#464D73', '--text-3': '#737994',
  },
  dark: {
    '--theme-ink': '#F4C95D',
    '--bg': '#0A0F24', '--bg-raised': '#121937', '--surface': '#151C3F', '--surface-2': '#1B2349', '--surface-3': '#283166',
    '--page-bg': '#131A3A', '--text': '#EDEFFA', '--text-2': '#B6BCDA', '--text-3': '#8D93B5',
  },
};

const ACCENT_VARS = ['--theme-pale', '--theme-hi', '--theme', '--theme-lo', '--theme-strong', '--theme-deep', '--theme-bright'];
const CHROME_VARS = ['--chrome-0', '--chrome-1', '--chrome-2', '--chrome-3'];
const LIGHT_SURFACES = ['--bg', '--surface-2', '--surface-3', '--page-bg'];
const LIGHT_TEXT = ['--text', '--text-2', '--text-3'];
const DARK_NEUTRALS = ['--bg', '--bg-raised', '--surface', '--surface-2', '--surface-3', '--page-bg', '--text', '--text-2', '--text-3'];

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

export const rgbToHex = (rgb) => `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinear({ l, c, h }) {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

export function oklchToHex({ l, c, h }) {
  const L = Math.min(1, Math.max(0, l));
  let lo = 0;
  let hi = Math.max(0, c);
  if (!inGamut(oklchToLinear({ l: L, c: hi, h }))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ l: L, c: mid, h }))) lo = mid;
      else hi = mid;
    }
    hi = lo;
  }
  return rgbToHex(oklchToLinear({ l: L, c: hi, h }).map(toGamma));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const minContrast = (hex, backgrounds) => Math.min(...backgrounds.map((bg) => contrast(hex, bg)));

function ensureContrast(hex, backgrounds, target, direction) {
  let o = hexToOklch(hex);
  for (let i = 0; i < 60 && minContrast(oklchToHex(o), backgrounds) < target; i++) {
    o = { ...o, l: o.l + direction * 0.01 };
    if (o.l <= 0 || o.l >= 1) break;
  }
  const out = oklchToHex(o);
  if (minContrast(out, backgrounds) < target) throw new Error(`Can't reach ${target}:1 contrast for ${hex}`);
  return out;
}

function transfer(refHex, refBase, base, { chromaScale = 1, keepHue = false } = {}) {
  const ref = hexToOklch(refHex);
  const rb = hexToOklch(refBase);
  const hue = keepHue ? base.h : base.h + (ref.h - rb.h);
  const ratio = rb.c > 0.001 ? ref.c / rb.c : 1;
  return oklchToHex({ l: base.l + (ref.l - rb.l), c: base.c * ratio * chromaScale, h: (hue + 360) % 360 });
}

const retint = (refHex, hue, maxChroma) => {
  const ref = hexToOklch(refHex);
  return oklchToHex({ l: ref.l, c: Math.min(ref.c, maxChroma), h: hue });
};

export function compileTheme(input = {}) {
  if (!input.accent || input.preset === 'default') return { ...structuredClone(DEFAULT), isDefault: true, themeColor: DEFAULT.light['--chrome-2'] };
  const refAccent = hexToOklch(DEFAULT.accent);
  const accent = hexToOklch(input.accent);
  let chrome = hexToOklch(input.chrome || input.accent);
  if (chrome.l > 0.42) chrome = { ...chrome, l: 0.42 };
  const refChrome = hexToOklch(DEFAULT.chrome);

  const light = {};
  const dark = {};
  for (const v of ACCENT_VARS) light[v] = transfer(DEFAULT.light[v], DEFAULT.accent, accent, { keepHue: true });
  light['--theme'] = oklchToHex(accent);
  for (const v of CHROME_VARS) light[v] = transfer(DEFAULT.light[v], DEFAULT.chrome, chrome, { keepHue: true });
  light['--chrome-ink'] = oklchToHex({ l: 0.96, c: Math.min(chrome.c, 0.02), h: chrome.h });

  const chromeHue = chrome.c < 0.02 ? refChrome.h : chrome.h;
  const accentHue = accent.c < 0.02 ? hexToOklch(DEFAULT.light['--bg']).h : accent.h;
  for (const v of LIGHT_SURFACES) light[v] = retint(DEFAULT.light[v], accentHue, 0.018);
  for (const v of LIGHT_TEXT) light[v] = retint(DEFAULT.light[v], chromeHue, 0.035);
  for (const v of DARK_NEUTRALS) dark[v] = retint(DEFAULT.dark[v], chromeHue, v.startsWith('--text') ? 0.03 : Math.max(0.025, Math.min(chrome.c, 0.05)));

  const fills = [light['--theme-hi'], light['--theme'], light['--theme-lo']];
  const darkInk = oklchToHex({ l: 0.24, c: Math.min(chrome.c, 0.08), h: chromeHue });
  light['--on-theme'] = minContrast(darkInk, fills) >= minContrast('#FFFFFF', fills) ? darkInk : '#FFFFFF';
  if (minContrast(light['--on-theme'], fills) < 4.5) {
    const direction = light['--on-theme'] === '#FFFFFF' ? -1 : 1;
    for (const v of ['--theme-hi', '--theme', '--theme-lo']) {
      light[v] = ensureContrast(light[v], [light['--on-theme']], 4.5, direction);
    }
  }

  light['--theme-ink'] = ensureContrast(input.accent, [light['--bg'], '#FFFFFF', light['--surface-2']], 4.5, -1);
  dark['--theme-ink'] = ensureContrast(input.accent, [dark['--bg'], dark['--bg-raised'], dark['--surface-2']], 4.5, 1);
  light['--theme-bright'] = ensureContrast(light['--theme-bright'], [light['--chrome-1'], light['--chrome-2']], 4.5, 1);
  light['--chrome-ink'] = ensureContrast(light['--chrome-ink'], [light['--chrome-0'], light['--chrome-1']], 7, 1);
  for (const [bg, fg] of [['--bg', '--text-3'], ['--surface-2', '--text-3']]) {
    light[fg] = ensureContrast(light[fg], [light[bg]], 4.5, -1);
  }
  dark['--text-3'] = ensureContrast(dark['--text-3'], [dark['--bg'], dark['--surface-2']], 4.5, 1);

  return { light, dark, themeColor: light['--chrome-2'], isDefault: false };
}

const declarations = (vars) => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

export function themeCss(theme) {
  if (!theme || theme.isDefault) return '';
  return `:root{${declarations(theme.light)}}`
    + `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${declarations(theme.dark)}}}`
    + `:root[data-theme="dark"]{${declarations(theme.dark)}}`;
}

export function tileVars(theme) {
  const l = theme.light;
  return {
    '--t-chrome-0': l['--chrome-0'], '--t-chrome-1': l['--chrome-1'], '--t-chrome-2': l['--chrome-2'],
    '--t-theme': l['--theme'], '--t-bright': l['--theme-bright'], '--t-hi': l['--theme-hi'], '--t-lo': l['--theme-lo'],
    '--t-on-theme': l['--on-theme'], '--t-ink': l['--chrome-ink'],
  };
}
