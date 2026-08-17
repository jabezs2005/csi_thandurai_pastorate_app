import { supabase } from '../lib/supabase';

export async function logActivity(
  adminId: string,
  churchId: string | null,
  actionType: string,
  targetType: string,
  targetId?: string | null,
  description?: string,
  changes?: Record<string, any>
) {
  const { error } = await supabase.from('activity_logs').insert({
    admin_id: adminId,
    church_id: churchId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId || null,
    description: description || `${actionType} ${targetType}`,
    changes: changes || {},
  });
  if (error) {
    console.error('Failed to log activity:', error.message);
  }
}
