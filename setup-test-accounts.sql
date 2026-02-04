-- 設置測試帳號的 SQL 腳本
-- 請在 Supabase SQL Editor 中執行

-- 1. 首先確保 user_usage 表存在
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

-- 2. 為特定測試帳號設置高權限
-- 注意：這個腳本會在用戶首次登入後自動執行
-- 你也可以手動在 Supabase Dashboard 的 Authentication > Users 中查看用戶 ID

-- 3. 創建一個函數來自動設置特殊帳號
CREATE OR REPLACE FUNCTION setup_special_accounts()
RETURNS TRIGGER AS $$
BEGIN
  -- 檢查是否為特殊帳號
  IF NEW.email IN ('1234@gmail.com', 'admin@example.com', 'test@example.com') THEN
    -- 插入或更新 user_usage 記錄
    INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
    VALUES (NEW.id, NEW.email, 0, 100, true)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      max_usage = 100,
      is_premium = true,
      email = NEW.email;
  ELSE
    -- 一般用戶
    INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
    VALUES (NEW.id, NEW.email, 0, 10, false)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      email = NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 創建觸發器，在用戶註冊時自動執行
DROP TRIGGER IF EXISTS setup_user_usage_trigger ON auth.users;
CREATE TRIGGER setup_user_usage_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION setup_special_accounts();

-- 5. 為現有用戶手動設置（如果需要）
-- 如果 1234@gmail.com 已經註冊，執行以下語句：
/*
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT id, email, 0, 100, true
FROM auth.users 
WHERE email = '1234@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
  max_usage = 100,
  is_premium = true;
*/