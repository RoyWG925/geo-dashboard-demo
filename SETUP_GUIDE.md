# 系統設置指南

## 資料庫設置步驟

### 步驟 1: 創建 user_keywords 表

1. 登入 Supabase Dashboard: https://supabase.com/dashboard
2. 選擇你的專案
3. 點擊左側選單的 "SQL Editor"
4. 點擊 "New query"
5. 複製 `user-keywords-schema.sql` 的完整內容
6. 貼上並點擊 "Run"

### 步驟 2: 驗證表格創建

執行以下 SQL 確認表格已創建：

```sql
-- 檢查表格是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'user_keywords';

-- 檢查表格結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_keywords'
ORDER BY ordinal_position;

-- 檢查 RLS 政策
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_keywords';
```

### 步驟 3: 測試表格功能

```sql
-- 測試插入（使用你的 user_id）
INSERT INTO public.user_keywords (user_id, keyword)
VALUES ('your-user-id-here', '測試關鍵字');

-- 查詢你的關鍵字
SELECT * FROM public.user_keywords;

-- 刪除測試數據
DELETE FROM public.user_keywords WHERE keyword = '測試關鍵字';
```

### 步驟 4: 重新整理 Schema Cache

在 Supabase Dashboard:
1. 點擊左側選單的 "Table Editor"
2. 確認可以看到 `user_keywords` 表
3. 如果看不到，點擊右上角的 "Refresh" 按鈕

或者在 SQL Editor 執行：

```sql
-- 重新整理 schema cache
NOTIFY pgrst, 'reload schema';
```

## 常見問題排查

### 問題 1: "Could not find the table 'public.user_keywords'"

**原因**: 表格尚未創建或 schema cache 未更新

**解決方法**:
1. 確認已執行 `user-keywords-schema.sql`
2. 在 Supabase Dashboard 重新整理頁面
3. 執行 `NOTIFY pgrst, 'reload schema';`
4. 等待 1-2 分鐘讓 cache 更新

### 問題 2: RLS 政策阻止操作

**原因**: Row Level Security 政策配置錯誤

**解決方法**:
```sql
-- 檢查當前用戶
SELECT auth.uid();

-- 暫時禁用 RLS 進行測試（僅用於開發環境）
ALTER TABLE public.user_keywords DISABLE ROW LEVEL SECURITY;

-- 測試完成後重新啟用
ALTER TABLE public.user_keywords ENABLE ROW LEVEL SECURITY;
```

### 問題 3: 權限錯誤

**原因**: 用戶沒有 Premium 權限

**解決方法**:
```sql
-- 將用戶設為 Premium
UPDATE public.user_usage
SET is_premium = true, max_usage = 999999
WHERE email = 'your-email@example.com';
```

## 功能測試清單

### 用戶自定義關鍵字
- [ ] Premium 用戶可以新增關鍵字
- [ ] 關鍵字保存到資料庫
- [ ] 下次登入時自動載入
- [ ] 可以刪除自定義關鍵字
- [ ] ★ 標記正確顯示
- [ ] 普通用戶看到權限提示

### 分析歷史紀錄
- [ ] 點擊「歷史紀錄」按鈕打開面板
- [ ] 顯示最近 20 筆分析記錄
- [ ] 顯示關鍵字、時間、PAA 數量
- [ ] 點擊歷史記錄可載入結果
- [ ] 關閉面板功能正常

### 整體功能
- [ ] 串流輸出正常運作
- [ ] 資料庫快取功能正常
- [ ] 自定義 Prompt 功能正常
- [ ] 模型選擇功能正常
- [ ] PAA 數據抓取正常

## 開發環境設置

### 環境變數檢查

確認 `.env.local` 包含以下變數：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Apify
APIFY_API_TOKEN=your-apify-token
```

### 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發服務器
npm run dev

# 檢查 ESLint
npm run lint

# 構建生產版本
npm run build
```

## 部署檢查清單

### Vercel 部署
- [ ] 環境變數已設置
- [ ] 構建成功
- [ ] 無 TypeScript 錯誤
- [ ] 無 ESLint 錯誤

### Supabase 配置
- [ ] RLS 政策已啟用
- [ ] 表格已創建
- [ ] 索引已建立
- [ ] 觸發器正常運作

### 功能驗證
- [ ] 用戶認證正常
- [ ] 資料庫連接正常
- [ ] API 端點正常
- [ ] 串流功能正常

## 監控和維護

### 定期檢查

```sql
-- 檢查用戶關鍵字數量
SELECT 
  COUNT(*) as total_keywords,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(keywords_per_user) as avg_per_user
FROM (
  SELECT user_id, COUNT(*) as keywords_per_user
  FROM public.user_keywords
  GROUP BY user_id
) subquery;

-- 檢查分析歷史數量
SELECT 
  COUNT(*) as total_analyses,
  COUNT(DISTINCT keyword) as unique_keywords,
  DATE(created_at) as date,
  COUNT(*) as daily_count
FROM public.geo_analysis_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 檢查用戶使用情況
SELECT 
  email,
  usage_count,
  max_usage,
  is_premium,
  last_used_at
FROM public.user_usage
ORDER BY last_used_at DESC
LIMIT 10;
```

### 清理舊數據

```sql
-- 刪除 30 天前的分析記錄（可選）
DELETE FROM public.geo_analysis_results
WHERE created_at < NOW() - INTERVAL '30 days';

-- 刪除未使用的關鍵字（可選）
DELETE FROM public.user_keywords
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM public.user_usage
);
```

## 效能優化

### 資料庫索引

```sql
-- 檢查索引使用情況
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('user_keywords', 'geo_analysis_results', 'user_usage')
ORDER BY idx_scan DESC;
```

### 查詢優化

```sql
-- 分析查詢計劃
EXPLAIN ANALYZE
SELECT * FROM public.user_keywords
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;
```

## 安全性檢查

### RLS 測試

```sql
-- 測試 RLS 政策（以不同用戶身份）
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'user-id-1';

-- 應該只看到 user-id-1 的關鍵字
SELECT * FROM public.user_keywords;

-- 嘗試插入其他用戶的關鍵字（應該失敗）
INSERT INTO public.user_keywords (user_id, keyword)
VALUES ('user-id-2', '測試');
```

### 權限檢查

```sql
-- 檢查表格權限
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_keywords';
```

## 支援資源

- [Supabase 文檔](https://supabase.com/docs)
- [Next.js 文檔](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Apify 文檔](https://docs.apify.com/)

## 聯繫方式

如有問題，請聯繫：
- 電子郵件：jg971402@gmail.com
- 管理員後台：/admin
