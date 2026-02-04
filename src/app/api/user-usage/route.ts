import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // 檢查用戶認證
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 查詢用戶使用記錄
    const { data: usage, error } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    // 如果沒有記錄，創建新記錄
    if (!usage) {
      // 檢查是否為管理員帳號
      const isAdmin = ['jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com'].includes(user.email || '');
      
      const { data: newUsage, error: insertError } = await supabase
        .from('user_usage')
        .insert({
          user_id: user.id,
          email: user.email,
          usage_count: 0,
          max_usage: isAdmin ? 999999 : 10,
          is_premium: isAdmin
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create usage record:', insertError);
        // 如果插入失敗，返回預設值
        return NextResponse.json({
          user_id: user.id,
          email: user.email,
          usage_count: 0,
          max_usage: isAdmin ? 999999 : 10,
          is_premium: isAdmin
        });
      }
      return NextResponse.json(newUsage);
    }

    return NextResponse.json(usage);
  } catch (error: any) {
    console.error('Usage check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    
    // 檢查用戶認證
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 增加使用次數
    const { data: usage, error } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'User usage not found' }, { status: 404 });
    }

    // 檢查是否超過限制
    if (usage.usage_count >= usage.max_usage && !usage.is_premium) {
      return NextResponse.json({ 
        error: 'Usage limit exceeded',
        message: '您已達到使用次數上限，請聯繫管理員以獲得更多使用次數。',
        contactEmail: 'jg971402@gmail.com'
      }, { status: 403 });
    }

    // 更新使用次數
    const { data: updatedUsage, error: updateError } = await supabase
      .from('user_usage')
      .update({ 
        usage_count: usage.usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(updatedUsage);
  } catch (error: any) {
    console.error('Usage increment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}