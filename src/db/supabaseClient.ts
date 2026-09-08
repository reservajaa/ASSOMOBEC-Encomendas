import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://gzwraiiqxzerrrwsbmxg.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_OGg-SAymjTSbk_kXUiqZEA_P9X_MIKp';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
