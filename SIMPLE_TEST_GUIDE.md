# 🚀 簡化測試指南

## 步驟 1：修復資料庫問題

**在 Supabase SQL Editor 中執行：**

```sql
-- 複製 fix-auth-issues.sql 的全部內容並執行
```

這會：
- ✅ 移除有問題的觸發器
- ✅ 簡化 RLS 政策
- ✅ 允許正常註冊用戶

## 步驟 2：在 Supabase Dashboard 中手動創建用戶

由於註冊可能還有問題，我們直接在 Supabase 後台創建用戶：

### 2.1 前往 Supabase Dashboard
1. 登入 [supabase.com](https://supabase.com)
2. 選擇你的專案
3. 點擊 **Authentication** > **Users**

### 2.2 創建管理員用戶
點擊 **"Invite user"** 或 **"Add user"**：

**管理員 1：**
- Email: `dustin@growthmarketing.tw`
- Password: `TempPass123!`
- ✅ 勾選 "Auto Confirm User"（如果有這個選項）

**管理員 2：**
- Email: `admin.test@gmail.com`
- Password: `TempPass123!`
- ✅ 勾選 "Auto Confirm User"

### 2.3 創建普通用戶
**普通用戶：**
- Email: `user.test@gmail.com`
- Password: `TempPass123!`
- ✅ 勾選 "Auto Confirm User"

## 步驟 3：設置用戶權限

**在 Supabase SQL Editor 中執行：**

```sql
-- 為手動創建的用戶設置權限
SELECT create_user_usage_record('dustin@growthmarketing.tw');
SELECT create_user_usage_record('admin.test@gmail.com');
SELECT create_user_usage_record('user.test@gmail.com');

-- 手動設置管理員權限
UPDATE user_usage 
SET max_usage = 999999, is_premium = true 
WHERE email IN ('dustin@growthmarketing.tw', 'admin.test@gmail.com');

-- 檢查結果
SELECT 
  email,
  usage_count,
  max_usage,
  is_premium,
  CASE 
    WHEN email IN ('dustin@growthmarketing.tw', 'admin.test@gmail.com') THEN '🔑 管理員'
    ELSE '👤 普通用戶'
  END as role
FROM user_usage;
```

## 步驟 4：測試登入

### 4.1 測試管理員登入
- Email: `dustin@growthmarketing.tw`
- Password: `TempPass123!`

**預期結果：**
- ✅ 成功登入
- ✅ 顯示 999999/999999 使用次數 + 👑
- ✅ 可以訪問 `/admin` 頁面

### 4.2 測試普通用戶登入
- Email: `user.test@gmail.com`
- Password: `TempPass123!`

**預期結果：**
- ✅ 成功登入
- ✅ 顯示 10/10 使用次數
- ❌ 無法訪問 `/admin` 頁面

### 4.3 測試 Google 登入
使用 `jg971402@gmail.com` 進行 Google 登入

**預期結果：**
- ✅ 成功登入
- ✅ 自動獲得管理員權限

## 步驟 5：測試功能

### 5.1 測試 GEO 分析
1. 選擇一個關鍵字（如：滴雞精推薦）
2. 點擊「執行 GEO 分析」
3. 等待結果

### 5.2 測試微調功能
1. 在有結果的關鍵字上點擊「微調內容」
2. 輸入修改建議：「移除關於腎臟病患者的建議」
3. 點擊「執行微調」

### 5.3 測試管理後台
1. 使用管理員帳號登入
2. 訪問 `/admin`
3. 查看用戶列表和使用統計

## 🔧 如果還是有問題

### 檢查 1：確認表格存在
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_usage', 'content_refinements', 'geo_analysis_results');
```

### 檢查 2：確認用戶記錄
```sql
SELECT u.email, uu.* 
FROM auth.users u 
LEFT JOIN user_usage uu ON u.id = uu.user_id;
```

### 檢查 3：手動創建缺失記錄
```sql
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT id, email, 0, 999999, true
FROM auth.users 
WHERE email = 'dustin@growthmarketing.tw'
ON CONFLICT (user_id) DO NOTHING;
```

## ✅ 成功指標

全部設置完成後，你應該能夠：
- ✅ 使用手動創建的帳號登入
- ✅ 看到正確的使用次數顯示
- ✅ 執行 GEO 分析功能
- ✅ 使用微調功能
- ✅ 管理員可以訪問後台

**這個方法繞過了註冊問題，直接在後台創建用戶，應該能正常工作！**