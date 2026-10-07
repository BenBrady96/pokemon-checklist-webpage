try {
  var p = JSON.parse(localStorage.getItem('bt:v1:prefs') || localStorage.getItem('p30c:prefs:v1') || '{}');
  if (p.theme === 'light' || p.theme === 'dark') document.documentElement.dataset.theme = p.theme;
} catch (e) {}
