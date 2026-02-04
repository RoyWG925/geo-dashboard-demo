-- ================================
-- GEO Analytics 完整資料庫設置腳本
-- 可以直接貼到 Supabase SQL Editor 執行
-- ================================

-- 1. 用戶使用次數管理表
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER DEFAULT 10,
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id)
);

-- 2. 內容微調記錄表
CREATE TABLE IF NOT EXISTS content_refinements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  original_content TEXT NOT NULL,
  refinement_prompt TEXT NOT NULL,
  refined_content TEXT NOT NULL,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. GEO 分析結果表
CREATE TABLE IF NOT EXISTS geo_analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  paa_questions JSONB,
  geo_optimized_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 啟用 Row Level Security (RLS)
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_refinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_analysis_results ENABLE ROW LEVEL SECURITY;

-- 5. 刪除舊的政策（如果存在）
DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can update own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can view own refinements" ON content_refinements;
DROP POLICY IF EXISTS "Users can insert own refinements" ON content_refinements;
DROP POLICY IF EXISTS "All users can view geo results" ON geo_analysis_results;
DROP POLICY IF EXISTS "All users can insert geo results" ON geo_analysis_results;

-- 6. 用戶使用次數表的 RLS 政策
CREATE POLICY "Users can view own usage" ON user_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON user_usage
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON user_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. 內容微調記錄表的 RLS 政策
CREATE POLICY "Users can view own refinements" ON content_refinements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own refinements" ON content_refinements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. GEO 分析結果表的 RLS 政策（所有用戶可讀）
CREATE POLICY "All users can view geo results" ON geo_analysis_results
  FOR SELECT USING (true);

CREATE POLICY "All users can insert geo results" ON geo_analysis_results
  FOR INSERT WITH CHECK (true);

-- 9. 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_content_refinements_user_id ON content_refinements(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_analysis_keyword ON geo_analysis_results(keyword);
CREATE INDEX IF NOT EXISTS idx_content_refinements_created_at ON content_refinements(created_at);

-- 10. 刪除舊的函數和觸發器（如果存在）
DROP TRIGGER IF EXISTS setup_user_usage_trigger ON auth.users;
DROP FUNCTION IF EXISTS setup_user_usage();

-- 11. 創建自動設置用戶權限的函數
CREATE OR REPLACE FUNCTION setup_user_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- 檢查是否為管理員帳號（解鎖全部功能）
  IF NEW.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com') THEN
    -- 管理員帳號：無限使用 + Premium + 管理員權限
    INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
    VALUES (NEW.id, NEW.email, 0, 999999, true)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      max_usage = 999999,
      is_premium = true,
      email = NEW.email;
  ELSIF NEW.email IN ('123456@gmail.com') THEN
    -- 普通測試用戶：10 次使用機會
    INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
    VALUES (NEW.id, NEW.email, 0, 10, false)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      max_usage = 10,
      is_premium = false,
      email = NEW.email;
  ELSE
    -- 其他一般用戶：10 次使用機會
    INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
    VALUES (NEW.id, NEW.email, 0, 10, false)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      email = NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. 創建觸發器，在用戶註冊時自動執行
CREATE TRIGGER setup_user_usage_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION setup_user_usage();

-- 13. 為現有用戶設置使用記錄（如果有的話）
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT 
  id,
  email,
  0,
  CASE 
    WHEN email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com') THEN 999999
    WHEN email IN ('123456@gmail.com') THEN 10
    ELSE 10
  END,
  CASE 
    WHEN email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com') THEN true
    ELSE false
  END
FROM auth.users 
ON CONFLICT (user_id) 
DO UPDATE SET 
  max_usage = CASE 
    WHEN excluded.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com') THEN 999999
    WHEN excluded.email IN ('123456@gmail.com') THEN 10
    ELSE user_usage.max_usage
  END,
  is_premium = CASE 
    WHEN excluded.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com') THEN true
    ELSE user_usage.is_premium
  END;

-- 14. 顯示設置結果
SELECT 
  'Setup completed successfully!' as status,
  COUNT(*) as tables_created
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_usage', 'content_refinements', 'geo_analysis_results');

-- 15. 顯示現有用戶的權限設置
SELECT 
  u.email,
  uu.usage_count,
  uu.max_usage,
  uu.is_premium,
  CASE 
    WHEN u.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw') THEN '🔑 管理員'
    WHEN u.email = '123456@gmail.com' THEN '👤 普通用戶'
    ELSE '👥 一般用戶'
  END as account_type,
  uu.created_at
FROM auth.users u
LEFT JOIN user_usage uu ON u.id = uu.user_id
ORDER BY 
  CASE 
    WHEN u.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw') THEN 1
    WHEN u.email = '123456@gmail.com' THEN 2
    ELSE 3
  END;