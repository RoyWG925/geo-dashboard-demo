-- 最終帳號設置腳本
-- 在 Supabase SQL Editor 中執行

-- 1. 更新函數以包含正確的帳號權限
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

-- 2. 為現有用戶設置正確的權限
-- 管理員帳號
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT 
  id,
  email,
  0,
  999999,
  true
FROM auth.users 
WHERE email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw')
ON CONFLICT (user_id) 
DO UPDATE SET 
  max_usage = 999999,
  is_premium = true,
  usage_count = 0;

-- 普通用戶帳號
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT 
  id,
  email,
  0,
  10,
  false
FROM auth.users 
WHERE email = '123456@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
  max_usage = 10,
  is_premium = false,
  usage_count = 0;

-- 3. 顯示所有設置的帳號
SELECT 
  u.email,
  uu.usage_count,
  uu.max_usage,
  uu.is_premium,
  CASE 
    WHEN u.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw') THEN '管理員'
    WHEN u.email = '123456@gmail.com' THEN '普通用戶'
    ELSE '一般用戶'
  END as account_type,
  uu.created_at
FROM auth.users u
LEFT JOIN user_usage uu ON u.id = uu.user_id
WHERE u.email IN ('jg971402@gmail.com', 'dustin@growthmarketing.tw', '123456@gmail.com')
ORDER BY account_type DESC;