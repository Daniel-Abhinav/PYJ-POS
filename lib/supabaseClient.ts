// @ts-nocheck
const supabaseUrl = 'https://zahijhnprduytnyhilhj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphaGlqaG5wcmR1eXRueWhpbGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzcyMTAsImV4cCI6MjA3MjE1MzIxMH0.xkm4RYWvE5zBaNTwjK4y5ipW2GMZOK7KKgmvEjhsujs';

// Fix: Reference the global `supabase` object from the CDN, which is attached to the window object.
export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
