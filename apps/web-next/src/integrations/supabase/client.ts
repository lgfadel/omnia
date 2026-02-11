// Supabase browser client for Next.js — uses cookie-based session storage
// so that the middleware (server-side) and the client share the same session.
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { logger } from '../../lib/logging';

// Supabase project configuration — values come from .env.local (dev) or Vercel env vars (prod)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (dev) or Vercel dashboard (prod).'
  );
}

export const SUPABASE_ANON_KEY: string = SUPABASE_PUBLISHABLE_KEY!;
// Re-export as typed string (validated above)
const _SUPABASE_URL: string = SUPABASE_URL!;
export { _SUPABASE_URL as SUPABASE_URL };

const isBrowser = typeof window !== 'undefined';
if (isBrowser) {
  logger.debug('[SUPABASE] Initializing browser client with URL:', SUPABASE_URL);
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// createBrowserClient from @supabase/ssr stores the session in cookies
// (via document.cookie) instead of localStorage, which allows the
// Next.js middleware to read the session on the server side.
export const supabase = createBrowserClient<Database>(
  SUPABASE_URL!,
  SUPABASE_PUBLISHABLE_KEY!,
);