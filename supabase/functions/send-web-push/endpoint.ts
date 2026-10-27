export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host === 'push.apple.com' || host.endsWith('.push.apple.com'))
  } catch {
    return false
  }
}
