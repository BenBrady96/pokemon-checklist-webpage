export const cameraSupported = () => Boolean(navigator.mediaDevices?.getUserMedia);

export const getCamera = () => navigator.mediaDevices.getUserMedia({
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
});

export function stopTracks(stream) {
  for (const track of stream?.getTracks() || []) track.stop();
}

export const cameraBlocked = (err) => err?.name === 'NotAllowedError';
