// @ts-nocheck
const supabaseUrl = 'https://gxfwswslamykjhjlmzqx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Zndzd3NsYW15a2poamxtenF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzkyMjgsImV4cCI6MjA5MjAxNTIyOH0.aieKFbl95A8RYYxYsyPh41wfc_7xCBoUDwmKSPC1-qs';

// Fix: Reference the global `supabase` object from the CDN, which is attached to the window object.
export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
