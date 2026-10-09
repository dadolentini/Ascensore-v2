const APP_ROUTES = new Set(['/', '/come-funziona', '/gli-algoritmi']);

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/') || basePath.startsWith('//') || /[?#]/.test(basePath)) {
    throw new TypeError('La base del sito deve essere un percorso assoluto locale.');
  }
  return basePath.replace(/\/+$/, '') + '/';
}

/** Maps an app-local URL to its deployment directory, preserving native links. */
export function withBasePath(path: string, basePath = import.meta.env.BASE_URL): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const base = normalizeBasePath(basePath);
  const pathname = path.split(/[?#]/)[0];
  if (base === '/' || pathname === base.slice(0, -1) || pathname.startsWith(base)) return path;
  return base + path.slice(1);
}

/** Returns the app-local URL, or null when the URL lies outside this deployment. */
export function fromBasePath(path: string, basePath = import.meta.env.BASE_URL): string | null {
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  const base = normalizeBasePath(basePath);
  if (base === '/') return path;
  const pathname = path.split(/[?#]/)[0];
  if (pathname === base.slice(0, -1)) return '/' + path.slice(pathname.length);
  return pathname.startsWith(base) ? '/' + path.slice(base.length) : null;
}

/** Route matching ignores query, fragment and the slash added by static hosting. */
export function isAppRoute(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return APP_ROUTES.has(pathname);
}
