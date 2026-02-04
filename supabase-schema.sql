-- 用戶使用次數管理表
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

-- 內容微調記錄表
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

-- GEO 分析結果表（如果不存在）
CREATE TABLE IF NOT EXISTS geo_analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  paa_questions JSONB,
  geo_optimized_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 啟用 Row Level Security (RLS)
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_refinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_analysis_results ENABLE ROW LEVEL SECURITY;

-- 用戶使用次數表的 RLS 政策
CREATE POLICY "Users can view own usage" ON user_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON user_usage
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON user_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 內容微調記錄表的 RLS 政策
CREATE POLICY "Users can view own refinements" ON content_refinements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own refinements" ON content_refinements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- GEO 分析結果表的 RLS 政策（所有用戶可讀）
CREATE POLICY "All users can view geo results" ON geo_analysis_results
  FOR SELECT USING (true);

CREATE POLICY "All users can insert geo results" ON geo_analysis_results
  FOR INSERT WITH CHECK (true);

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_content_refinements_user_id ON content_refinements(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_analysis_keyword ON geo_analysis_results(keyword);
CREATE INDEX IF NOT EXISTS idx_content_refinements_created_at ON content_refinements(created_at);

-- 插入一些測試用的特殊帳號設定（可選）
-- 這些帳號將有更高的使用次數限制
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT 
  id,
  email,
  0,
  100,  -- 特殊帳號有 100 次使用機會
  true
FROM auth.users 
WHERE email IN (
  'admin@example.com',
  'premium@example.com',
  'test@example.com',
  '123456@gmail.com'
)
ON CONFLICT (user_id) DO UPDATE SET
  max_usage = 100,
  is_premium = true;