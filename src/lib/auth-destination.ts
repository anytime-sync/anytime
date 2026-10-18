/** Keep auth return paths on this site, including when the URL is user supplied. */
export function authDestination(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/app';
  try {
    const url = new URL(value, 'https://firstlight.to');
    return url.origin === 'https://firstlight.to' ? `${url.pathname}${url.search}${url.hash}` : '/app';
  } catch {
    return '/app';
  }
}
