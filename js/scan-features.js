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
