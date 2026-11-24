import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://udkiroesyeqnlxhayzit.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVka2lyb2VzeWVxbmx4aGF5eml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NjA2NDIsImV4cCI6MjA5MjEzNjY0Mn0.Fidqh0HReohcyTYJXQVAQqJpMximelLL9B16H-s5J5s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

