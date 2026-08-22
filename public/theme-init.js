(function() {
  try {
    var storedTheme = localStorage.getItem('ai_dich_truyen_theme');
    var theme = storedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'custom') {
      var customColors = localStorage.getItem('ai_dich_truyen_custom_colors');
      if (customColors) {
        var parsed = JSON.parse(customColors);
        var style = document.documentElement.style;
        if (parsed.ink) style.setProperty('--color-ink', parsed.ink);
        if (parsed.parchment) style.setProperty('--color-parchment', parsed.parchment);
        if (parsed.parchment2) style.setProperty('--color-parchment-2', parsed.parchment2);
        if (parsed.textMain) style.setProperty('--color-text-main', parsed.textMain);
        if (parsed.textMuted) style.setProperty('--color-text-muted', parsed.textMuted);
        if (parsed.polish) style.setProperty('--color-polish', parsed.polish);
      }
    }
  } catch (e) {}
})();
