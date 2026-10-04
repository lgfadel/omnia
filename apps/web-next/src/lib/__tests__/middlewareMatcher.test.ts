import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it } from 'vitest'
import { config } from '../../../middleware'

describe('middleware matcher', () => {
  it.each([
    '/api',
    '/api/',
    '/api/v1/tasks',
    '/api/v1/tasks/22222222-2222-4222-8222-222222222222',
    '/api/v1/tasks?limit=10',
    '/api/v1/mcp/exchange',
    '/api/malotes/settings',
  ])('keeps %s outside the cookie middleware so API handlers own auth and conditional requests', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
  })

  it.each([
    '/apiary',
    '/apiary/tasks',
    '/apis',
    '/api-v1',
    '/',
    '/tarefas',
    '/tarefas/22222222-2222-4222-8222-222222222222',
    '/malotes',
    '/auth',
    '/reset-password',
    '/change-password',
    '/robots.txt',
  ])('preserves middleware matching for page path %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
  })

  it.each([
    '/_next/static/chunks/app.js',
    '/_next/image?url=%2Fphoto.png&w=640&q=75',
    '/favicon.ico',
    '/logo.svg',
    '/photo.png',
    '/photo.jpg',
    '/photo.jpeg',
    '/photo.gif',
    '/photo.webp',
  ])('preserves existing static exclusion for %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
  })
})
