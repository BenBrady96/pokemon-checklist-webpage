import { asset } from '../core/paths.js';
import { openDialog, closeDialog } from './ui.js';
import { cameraSupported, getCamera, stopTracks, cameraBlocked } from './camera.js';

const SCAN_WIDTH = 640;
const SCAN_EVERY_MS = 200;
const scripts = new Map();

function loadScript(path, global) {
  if (!scripts.has(path)) {
    scripts.set(path, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = asset(path);
      script.onload = () => resolve(window[global]);
      script.onerror = () => {
        scripts.delete(path);
        reject(new Error(`${path} failed to load`));
      };
      document.head.append(script);
    }));
  }
  return scripts.get(path);
}

export async function renderQr(container, text, { level = 'M', maxModules = 177 } = {}) {
  let qrcode;
  try {
    qrcode = await loadScript('js/vendor/qrcode.js', 'qrcode');
  } catch {
    container.innerHTML = '<p class="hint hint--small">QR code unavailable offline. Copy the link instead.</p>';
    return 'offline';
  }
  try {
    const qr = qrcode(0, level);
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    if (size > maxModules) throw new Error('Too big');
    let d = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    container.innerHTML = `<svg viewBox="-2 -2 ${size + 4} ${size + 4}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="#0E1433"/></svg>`;
    return 'ok';
  } catch {
    container.innerHTML = '<p class="hint hint--small">Too much to fit in a QR code. Copy the link instead.</p>';
    return 'big';
  }
}

const dlg = document.getElementById('dlg-qr');
const field = (name) => dlg?.querySelector(`[data-qr="${name}"]`);

let stream = null;
let starting = false;
let timer = 0;
let session = null;

function say(text) {
  field('status').textContent = text;
}

function stopCamera() {
  clearTimeout(timer);
  stopTracks(stream);
  stream = null;
  field('video').srcObject = null;
  dlg.classList.remove('has-camera');
}

async function startCamera() {
  if (stream || starting || !dlg.open || document.hidden) return;
  if (!cameraSupported()) {
    say('The camera needs the secure (https) version of this site. Paste the link or code instead.');
    return;
  }
  starting = true;
  try {
    const got = await getCamera();
    if (!dlg.open || document.hidden) {
      stopTracks(got);
      return;
    }
    stream = got;
    field('video').srcObject = stream;
    await field('video').play().catch(() => {});
    dlg.classList.add('has-camera');
    say('Fill the square with the QR code.');
    tick();
  } catch (err) {
    say(cameraBlocked(err)
      ? 'Camera access is blocked. Allow it in your browser’s site settings, or paste the link or code instead.'
      : 'Couldn’t start the camera. Paste the link or code instead.');
  } finally {
    starting = false;
  }
}

const canvas = document.createElement('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });

async function tick() {
  if (!stream || !session) return;
  const video = field('video');
  if (video.readyState >= 2 && video.videoWidth && !session.busy) {
    const scale = Math.min(1, SCAN_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const found = session.reader(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
    if (found?.data && found.data !== session.last) {
      session.last = found.data;
      session.busy = true;
      const ok = await session.accept(found.data);
      if (!session) return;
      session.busy = false;
      if (ok) {
        const done = session;
        session = null;
        done.resolve(found.data);
        closeDialog(dlg);
        return;
      }
      say('That QR code isn’t from Binder Tracker. Try another one.');
    }
  }
  timer = setTimeout(tick, SCAN_EVERY_MS);
}

let wired = false;

function wire() {
  dlg.addEventListener('close', () => {
    stopCamera();
    const open = session;
    session = null;
    open?.resolve(null);
  });
  document.addEventListener('visibilitychange', () => {
    if (!dlg.open) return;
    if (document.hidden) stopCamera();
    else startCamera();
  });
}

export async function scanQr({ accept }) {
  if (!wired) {
    wire();
    wired = true;
  }
  session?.resolve(null);
  const result = new Promise((resolve) => {
    session = { accept, resolve, reader: null, busy: false, last: '' };
  });
  const current = session;
  say('Getting the QR reader ready…');
  openDialog(dlg);
  try {
    current.reader = await loadScript('js/vendor/jsqr/jsQR.js', 'jsQR');
  } catch {
    say('The QR reader couldn’t load. Check your connection, or paste the link or code instead.');
    return result;
  }
  if (session === current) startCamera();
  return result;
}
