{
  const token = document.currentScript?.dataset.token;
  if (token && !location.hash.includes('=')) {
    const beacon = document.createElement('script');
    beacon.type = 'module';
    beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    beacon.dataset.cfBeacon = JSON.stringify({ token, spa: false });
    document.head.append(beacon);
  }
}
