import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://joeypoxopyrmkzrkbpfu.supabase.co'
const supabaseAnonKey = 'sb_publishable_dKP3Na-4zMBjQ_WjlPO-Pw_dvXvOW5n'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
