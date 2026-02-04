# 🔧 認證問題故障排除指南

## 問題描述
- `dustin@growthmarketing.tw` / `123456` 無法註冊或登入
- `123456@gmail.com` / `123456` 也有同樣問題
- 錯誤訊息：
  - 註冊：`Database error saving new user`
  - 登入：`Invalid login credentials`

## 🚨 可能的原因和解決方案

### 1. Supabase 認證設置問題

#### 檢查 Supabase Dashboard 設置：

1. **前往 Supabase Dashboard**
   - 登入 [supabase.com](https://supabase.com)
   - 選擇你的專案

2. **檢查認證設置**
   - 點擊左側選單 **Authentication**
   - 點擊 **Settings** 標籤

3. **確認以下設置**：
   - ✅ **Enable email confirmations**: 可以暫時關閉以便測試
   - ✅ **Enable phone confirmations**: 關閉
   - ✅ **Enable custom SMTP**: 如果沒有設置 SMTP，暫時關閉 email confirmation

#### 建議的認證設置：
```
Site URL: http://localhost:3000 (開發環境)
Additional Redirect URLs: http://localhost:3000/auth/callback

Enable email confirmations: ❌ (暫時關閉以便測試)
Enable phone confirmations: ❌
Enable custom SMTP: ❌ (除非你有設置)
```

### 2. 密碼強度問題

Supabase 預設要求密碼至少 6 個字符，但可能有其他限制：

#### 建議使用更強的密碼：
- `dustin@growthmarketing.tw` / `Password123!`
- `123456@gmail.com` / `Password123!`

### 3. Email 格式驗證

某些 email 格式可能被 Supabase 拒絕。

#### 建議的測試帳號：
- `dustin.test@gmail.com` / `Password123!`
- `test123456@gmail.com` / `Password123!`

### 4. 手動創建測試用戶

如果註冊仍然失敗，可以在 Supabase Dashboard 中手動創建用戶：

1. **前往 Authentication > Users**
2. **點擊 "Invite user"**
3. **輸入 Email**：`dustin@growthmarketing.tw`
4. **設置臨時密碼**：`Password123!`
5. **重複為其他測試帳號**

### 5. 檢查資料庫權限

執行以下 SQL 檢查權限：

```sql
-- 檢查 auth.users 表是否可訪問
SELECT COUNT(*) FROM auth.users;

-- 檢查 user_usage 表是否正確創建
SELECT COUNT(*) FROM user_usage;

-- 檢查 RLS 政策
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'user_usage';
```

## 🔄 完整解決步驟

### 步驟 1：更新 Supabase 認證設置
1. 關閉 email confirmation（暫時）
2. 設置正確的 redirect URLs

### 步驟 2：執行完整 SQL 腳本
複製 `complete-supabase-setup.sql` 到 Supabase SQL Editor 執行

### 步驟 3：手動創建測試用戶
在 Supabase Dashboard > Authentication > Users 中創建：

| Email | 密碼 | 角色 |
|-------|------|------|
| `dustin@growthmarketing.tw` | `Password123!` | 管理員 |
| `jg971402@gmail.com` | (Google 登入) | 管理員 |
| `test123456@gmail.com` | `Password123!` | 普通用戶 |

### 步驟 4：測試登入
1. 使用手動創建的帳號測試登入
2. 檢查是否正確顯示使用次數
3. 測試 GEO 分析功能

### 步驟 5：如果還是失敗
執行以下 SQL 手動設置用戶權限：

```sql
-- 為手動創建的用戶設置權限
INSERT INTO user_usage (user_id, email, usage_count, max_usage, is_premium)
SELECT 
  id,
  email,
  0,
  CASE 
    WHEN email IN ('dustin@growthmarketing.tw', 'jg971402@gmail.com') THEN 999999
    ELSE 10
  END,
  CASE 
    WHEN email IN ('dustin@growthmarketing.tw', 'jg971402@gmail.com') THEN true
    ELSE false
  END
FROM auth.users 
WHERE email IN ('dustin@growthmarketing.tw', 'jg971402@gmail.com', 'test123456@gmail.com')
ON CONFLICT (user_id) 
DO UPDATE SET 
  max_usage = excluded.max_usage,
  is_premium = excluded.is_premium;
```

## 📞 如果問題持續

1. **檢查瀏覽器控制台**的錯誤訊息
2. **檢查 Supabase Dashboard > Logs**
3. **嘗試使用 Google 登入**作為替代方案
4. **聯繫我**提供更詳細的錯誤訊息

## ✅ 成功指標

註冊/登入成功後，你應該看到：
- ✅ 成功重定向到主頁面
- ✅ 右上角顯示用戶 email
- ✅ 顯示使用次數 (管理員: 999999/999999 👑)
- ✅ 可以執行 GEO 分析
- ✅ 管理員可以訪問 `/admin` 頁面