-- ================================
-- 修復認證問題的 SQL 腳本
-- 解決 "Database error creating new user" 問題
-- ================================

-- 1. 暫時禁用觸發器以避免註冊時的錯誤
DROP TRIGGER IF EXISTS setup_user_usage_trigger ON auth.users;

-- 2. 暫時禁用 RLS 以便測試
ALTER TABLE user_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_refinements DISABLE ROW LEVEL SECURITY;
ALTER TABLE geo_analysis_results DISABLE ROW LEVEL SECURITY;

-- 3. 刪除可能有問題的政策
DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can update own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can view own refinements" ON content_refinements;
DROP POLICY IF EXISTS "Users can insert own refinements" ON content_refinements;
DROP POLICY IF EXISTS "All users can view geo results" ON geo_analysis_results;
DROP POLICY IF EXISTS "All users can insert geo results" ON geo_analysis_results;

-- 4. 重新創建簡化的政策
CREATE POLICY "Enable all for authenticated users" ON user_usage
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON content_refinements
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON geo_analysis_results
  FOR ALL USING (auth.role() = 'authenticated');

-- 5. 重新啟用 RLS
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_refinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_analysis_results ENABLE ROW LEVEL SECURITY;

-- 6. 創建簡化的用戶設置函數（不會在註冊時觸發）
CREATE OR REPLACE FUNCTION create_user_usage_record(user_email TEXT)
RETURNS VOID AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- 獲取用戶記錄
  SELECT id, email INTO user_record FROM auth.users WHERE email = user_email;
  
  IF user_record.id IS NOT NULL THEN
    -- 檢查是否為管理員帳號
    IF user_record.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com') THEN
      -- 管理員帳號：無限使用 + Premium
      INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
      VALUES (user_record.id, user_record.email, 0, 999999, true)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        max_usage = 999999,
        is_premium = true,
        email = user_record.email;
    ELSE
      -- 普通用戶：10 次使用機會
      INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
      VALUES (user_record.id, user_record.email, 0, 10, false)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        max_usage = 10,
        is_premium = false,
        email = user_record.email;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 顯示當前狀態
SELECT 
  'Auth fix completed!' as status,
  'Triggers disabled, RLS simplified' as note;

-- 8. 顯示現有用戶
SELECT 
  u.id,
  u.email,
  u.created_at,
  uu.usage_count,
  uu.max_usage,
  uu.is_premium
FROM auth.users u
LEFT JOIN user_usage uu ON u.id = uu.user_id
ORDER BY u.created_at DESC;