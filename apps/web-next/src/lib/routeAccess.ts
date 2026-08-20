export function isApiRoute(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/')
}
