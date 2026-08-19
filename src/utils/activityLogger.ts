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
  try {
    const {
      data,
      error,
    } = await supabase
      .from('activity_logs')
      .insert({
        admin_id: adminId,
        church_id: churchId,
        action_type: actionType,
        target_type: targetType,
        target_id:
          targetId || null,
        description:
          description ||
          `${actionType} ${targetType}`,
        changes:
          changes || {},
      })
      .select()
      .single();

    if (error) {
      console.error(
        'Failed to log activity:',
        error
      );

      return {
        success: false,
        data: null,
        error,
      };
    }

    console.log(
      'Activity log created successfully:',
      data
    );

    return {
      success: true,
      data,
      error: null,
    };
  } catch (error) {
    console.error(
      'Unexpected activity log error:',
      error
    );

    return {
      success: false,
      data: null,
      error,
    };
  }
}