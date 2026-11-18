import { supabase } from '../lib/supabase';

export interface NewEntry {
  church_id: string;
  member_id: string;
  kind: 'subscription' | 'building_fund';
  entry_date: string; // YYYY-MM-DD
  year: number;
  month: number;
  field_key: string;
  amount: number; // difference saved on this date (can be negative for a correction)
  created_by?: string | null;
}

// Returns an error message, or null when everything was stored
export async function recordEntries(entries: NewEntry[]): Promise<string | null> {
  if (entries.length === 0) return null;
  const { error } = await supabase.from('contribution_entries').insert(entries);
  return error ? error.message : null;
}
