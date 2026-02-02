// src/utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // 建立一個在瀏覽器端使用的 Supabase Client
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}