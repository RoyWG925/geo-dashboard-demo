-- 快速更新測試帳號腳本
-- 在 Supabase SQL Editor 中執行

-- 1. 更新函數以包含新的測試帳號
CREATE OR REPLACE FUNCTION setup_user_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- 檢查是否為特殊帳號
  IF NEW.email IN ('123456@gmail.com', 'admin@example.com', 'test@example.com') THEN
    -- 特殊帳號：100 次使用機會 + Premium
    INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
    VALUES (NEW.id, NEW.email, 0, 100, true)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      max_usage = 100,
      is_premium = true,
      email = NEW.email;
  ELSE
    -- 一般用戶：10 次使用機會
    INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
    VALUES (NEW.id, NEW.email, 0, 10, false)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      email = NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 如果 123456@gmail.com 已經註冊，為其設置特殊權限
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT 
  id,
  email,
  0,
  100,
  true
FROM auth.users 
WHERE email = '123456@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
  max_usage = 100,
  is_premium = true,
  usage_count = 0;  -- 重置使用次數

-- 3. 顯示結果
SELECT 
  u.email,
  uu.usage_count,
  uu.max_usage,
  uu.is_premium,
  uu.created_at
FROM auth.users u
LEFT JOIN user_usage uu ON u.id = uu.user_id
WHERE u.email = '123456@gmail.com';