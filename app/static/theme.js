// Runs before the page is drawn, so a saved light theme never flashes dark first.
try {
  if (JSON.parse(localStorage.getItem('sidecourt.theme')) === 'light') {
    document.documentElement.dataset.theme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f3f5fa');
  }
} catch {
  // Storage blocked: the app stays in the default dark theme.
}
