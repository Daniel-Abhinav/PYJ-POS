// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  typeof supabaseUrl === 'string' &&
  typeof supabaseAnonKey === 'string' &&
  supabaseUrl.trim() !== '' &&
  supabaseAnonKey.trim() !== '' &&
  !supabaseUrl.includes('placeholder')
);

// Resilient chainable mock client to handle offline/local mode without throwing unhandled TypeErrors
function createChainableQuery(resolvedValue: any = { data: null, error: new Error('Supabase not configured') }) {
  const handler: any = {
    get: (_target: any, prop: string) => {
      if (prop === 'then') {
        return (resolve: any) => resolve(resolvedValue);
      }
      if (prop === 'catch') {
        return () => Promise.resolve(resolvedValue);
      }
      return (..._args: any[]) => new Proxy({}, handler);
    }
  };
  return new Proxy({}, handler);
}

const mockChannel = {
  on: function() { return this; },
  subscribe: function(callback?: (status: string) => void) {
    if (callback) {
      setTimeout(() => callback('CLOSED'), 0);
    }
    return this;
  }
};

let client: any;

if (isSupabaseConfigured) {
  try {
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    } else {
      client = createClient(supabaseUrl, supabaseAnonKey);
    }
  } catch (err) {
    console.warn("Failed to initialize remote Supabase client, falling back to local mode:", err);
  }
}

if (!client) {
  client = {
    from: () => createChainableQuery(),
    rpc: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    channel: () => mockChannel,
    removeChannel: () => {},
  };
}

export const supabase = client;
