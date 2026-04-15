import { supabase } from '@/lib/supabase'

export async function getSystemSetting<T = unknown>(
  key: string
): Promise<{ value: T | null; error: string | null }> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error) {
    return { value: null, error: error.message }
  }

  return { value: data.value as T, error: null }
}

export async function setSystemSetting(
  key: string,
  value: unknown
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value: JSON.parse(JSON.stringify(value)) })

  return { error: error?.message ?? null }
}
