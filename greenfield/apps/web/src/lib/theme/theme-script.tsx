const storageKey = 'mc-shell-preferences';

const themeInitializer = `(function(){try{var stored=window.localStorage.getItem('${storageKey}');var mode='system';if(stored){var parsed=JSON.parse(stored);var candidate=parsed&&parsed.state?parsed.state.themeMode:null;if(candidate==='system'||candidate==='light'||candidate==='dark'){mode=candidate;}}var resolved=mode==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;document.documentElement.dataset.theme=resolved;}catch(_error){document.documentElement.dataset.theme='light';}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />;
}
