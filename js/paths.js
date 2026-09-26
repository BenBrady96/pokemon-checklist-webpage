export const ROOT = new URL('../', import.meta.url).href;

export const asset = (path) => new URL(path, ROOT).href;
