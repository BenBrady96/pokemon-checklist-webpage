const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export function pixelTensor(pixels, width, height, channels = 4) {
  const plane = width * height;
  const out = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++) {
    const p = i * channels;
    for (let c = 0; c < 3; c++) out[c * plane + i] = (pixels[p + c] / 255 - MEAN[c]) / STD[c];
  }
  return out;
}

const variance = (sum, sq, n) => sq / n - (sum / n) ** 2;

export function sharpness(pixels, width, height, channels = 4) {
  const grey = new Float32Array(width * height);
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < grey.length; i++) {
    const p = i * channels;
    const g = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
    grey[i] = g;
    sum += g;
    sq += g * g;
  }
  let lapSum = 0;
  let lapSq = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = grey[i - 1] + grey[i + 1] + grey[i - width] + grey[i + width] - 4 * grey[i];
      lapSum += lap;
      lapSq += lap * lap;
    }
  }
  const contrast = variance(sum, sq, grey.length);
  return contrast > 0 ? variance(lapSum, lapSq, (width - 2) * (height - 2)) / contrast : 0;
}

export function unit(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

function meanOfPatches(data, dims, tokens) {
  const out = new Float32Array(dims);
  for (let t = 1; t < tokens; t++) {
    const row = t * dims;
    for (let d = 0; d < dims; d++) out[d] += data[row + d];
  }
  return out;
}

export function embed(data, dims, tokens, pool) {
  if (pool === 'flat') return unit(Float32Array.from(data));
  const cls = unit(Float32Array.from(data.subarray(0, dims)));
  if (pool === 'cls') return cls;
  const patches = unit(meanOfPatches(data, dims, tokens));
  if (pool === 'mean') return patches;
  const both = new Float32Array(dims * 2);
  both.set(cls);
  both.set(patches, dims);
  return unit(both);
}
