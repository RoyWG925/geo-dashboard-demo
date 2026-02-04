# Supabase 資料庫設置指南

## 🚨 重要：請先執行以下 SQL 腳本

### 步驟 1：在 Supabase Dashboard 中執行 SQL

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的專案
3. 點擊左側選單的 **SQL Editor**
4. 點擊 **New Query**
5. 複製以下完整 SQL 腳本並執行：

```sql
-- ================================
-- GEO Analytics 資料庫設置腳本
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

-- 5. 用戶使用次數表的 RLS 政策
DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
CREATE POLICY "Users can view own usage" ON user_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON user_usage;
CREATE POLICY "Users can update own usage" ON user_usage
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own usage" ON user_usage;
CREATE POLICY "Users can insert own usage" ON user_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. 內容微調記錄表的 RLS 政策
DROP POLICY IF EXISTS "Users can view own refinements" ON content_refinements;
CREATE POLICY "Users can view own refinements" ON content_refinements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own refinements" ON content_refinements;
CREATE POLICY "Users can insert own refinements" ON content_refinements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. GEO 分析結果表的 RLS 政策（所有用戶可讀）
DROP POLICY IF EXISTS "All users can view geo results" ON geo_analysis_results;
CREATE POLICY "All users can view geo results" ON geo_analysis_results
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "All users can insert geo results" ON geo_analysis_results;
CREATE POLICY "All users can insert geo results" ON geo_analysis_results
  FOR INSERT WITH CHECK (true);

-- 8. 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_content_refinements_user_id ON content_refinements(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_analysis_keyword ON geo_analysis_results(keyword);
CREATE INDEX IF NOT EXISTS idx_content_refinements_created_at ON content_refinements(created_at);

-- 9. 創建自動設置用戶權限的函數
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

-- 10. 創建觸發器，在用戶註冊時自動執行
DROP TRIGGER IF EXISTS setup_user_usage_trigger ON auth.users;
CREATE TRIGGER setup_user_usage_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION setup_user_usage();

-- 11. 為現有用戶設置使用記錄（如果有的話）
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
ON CONFLICT (user_id) DO NOTHING;
```

### 步驟 2：註冊測試帳號

執行完 SQL 腳本後：

1. **註冊管理員帳號**：
   - Email/密碼登入：`dustin@growthmarketing.tw` / `123456`
   - Google 登入：`jg971402@gmail.com`（直接使用 Google 登入即可）

2. **註冊普通用戶帳號**：
   - 在登入頁面點擊「沒有帳號？點此註冊」
   - Email: `123456@gmail.com`
   - 密碼: `123456`
   - 點擊「註冊」

3. **檢查信箱驗證**：
   - 檢查相應信箱的驗證郵件
   - 點擊驗證連結（如果有的話）
   - 或者在 Supabase Dashboard > Authentication > Users 中手動驗證

### 步驟 3：測試功能

1. **管理員登入測試**：
   - 使用 `dustin@growthmarketing.tw` / `123456` 登入
   - 或使用 Google 帳號 `jg971402@gmail.com` 登入
   - 應該看到 999999/999999 使用次數 + 👑 Premium 標誌
   - 可以訪問 `/admin` 管理後台

2. **普通用戶登入測試**：
   - 使用 `123456@gmail.com` / `123456` 登入
   - 應該看到 10/10 使用次數（無 Premium 標誌）
   - 無法訪問管理後台

3. **測試 GEO 分析**：
   - 選擇一個關鍵字
   - 點擊「執行 GEO 分析」
   - 應該可以正常運行

## 🔧 故障排除

### 如果還是出現表格不存在的錯誤：

1. **檢查表格是否創建成功**：
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('user_usage', 'content_refinements', 'geo_analysis_results');
   ```

2. **檢查 RLS 政策**：
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE tablename IN ('user_usage', 'content_refinements', 'geo_analysis_results');
   ```

3. **手動創建用戶記錄**（如果需要）：
   ```sql
   -- 替換 'your-user-id' 為實際的用戶 ID
   INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
   VALUES ('your-user-id', 'your-email@example.com', 0, 100, true);
   ```

### 如果 Google 登入的用戶沒有使用記錄：

執行以下 SQL 為現有 Google 用戶創建記錄：
```sql
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT id, email, 0, 10, false
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM user_usage);
```

## ✅ 完成後你應該能夠：

- ✅ 使用 Google 登入
- ✅ 使用 Email/密碼登入 (123456@gmail.com/1234)
- ✅ 看到使用次數顯示
- ✅ 執行 GEO 分析
- ✅ 使用微調功能
- ✅ 訪問管理員後台 (如果是特殊帳號)