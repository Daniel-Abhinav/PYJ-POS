// @ts-nocheck

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key must be provided in environment variables.");
  const mockChannel = {
    on: function() { return this; },
    subscribe: function() { return this; }
  };

  // Provide a dummy client that fails gracefully to prevent white-screening the entire app
  client = {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ error: new Error('Supabase not configured') }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ error: new Error('Supabase not configured') }) }) }),
      update: () => Promise.resolve({ error: new Error('Supabase not configured') }),
    }),
    rpc: () => Promise.resolve({ error: new Error('Supabase not configured') }),
    channel: () => mockChannel,
    removeChannel: () => {},
  };
} else {
  client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = client;
