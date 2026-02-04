# 部署指南

## 🚀 Vercel 部署步驟

### 1. 準備工作

確保你已經有：
- Vercel 帳號
- Supabase 專案
- Google AI API Key
- Apify API Token

### 2. Supabase 設置

#### 2.1 創建 Supabase 專案
1. 前往 [Supabase](https://supabase.com)
2. 創建新專案
3. 記錄 Project URL 和 anon key

#### 2.2 執行資料庫腳本
1. 在 Supabase Dashboard 中，前往 SQL Editor
2. 複製 `supabase-schema.sql` 的內容
3. 執行腳本創建所需表格

#### 2.3 設置 Google OAuth
1. 前往 Authentication > Providers
2. 啟用 Google provider
3. 設置 Google OAuth 憑證：
   - Client ID
   - Client Secret
4. 設置 Redirect URLs：
   - `https://your-domain.vercel.app/auth/callback`

### 3. Vercel 部署

#### 3.1 連接 GitHub
```bash
# 推送代碼到 GitHub
git add .
git commit -m "Initial commit with improvements"
git push origin main
```

#### 3.2 部署到 Vercel
1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 點擊 "New Project"
3. 選擇你的 GitHub repository
4. 設置環境變數（見下方）
5. 點擊 "Deploy"

#### 3.3 設置環境變數

在 Vercel 專案設置中添加：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
APIFY_API_TOKEN=your_apify_token
```

### 4. 後續設置

#### 4.1 更新 Supabase 認證設置
部署完成後，更新 Supabase 中的：
- Site URL: `https://your-domain.vercel.app`
- Redirect URLs: `https://your-domain.vercel.app/auth/callback`

#### 4.2 測試功能
1. 訪問部署的網站
2. 測試 Google 登入
3. 測試關鍵字分析功能
4. 測試微調功能

## 🔧 本地開發設置

### 1. 克隆專案
```bash
git clone your-repo-url
cd geo-dashboard
npm install
```

### 2. 設置環境變數
```bash
cp .env.local.example .env.local
# 編輯 .env.local 填入你的 API keys
```

### 3. 啟動開發服務器
```bash
npm run dev
```

## 📊 監控和維護

### 1. 查看使用統計
- 訪問 `/admin` 頁面（需要管理員權限）
- 監控用戶使用情況
- 調整使用次數限制

### 2. 日誌監控
- 在 Vercel Dashboard 查看 Function Logs
- 監控 API 調用狀況
- 檢查錯誤報告

### 3. 資料庫維護
- 定期檢查 Supabase 使用量
- 清理舊的分析記錄
- 備份重要資料

## 🛠️ 故障排除

### 常見問題

#### 1. Google 登入失敗
- 檢查 Google OAuth 設置
- 確認 Redirect URL 正確
- 檢查 Client ID/Secret

#### 2. API 調用失敗
- 檢查 API Keys 是否正確
- 確認 Supabase 連接
- 查看 Vercel Function Logs

#### 3. 使用次數不更新
- 檢查 RLS 政策
- 確認用戶認證狀態
- 查看資料庫連接

### 聯繫支援
如有問題，請聯繫：admin@example.com

## 🔄 更新部署

### 自動部署
推送到 main 分支會自動觸發部署：
```bash
git add .
git commit -m "Update features"
git push origin main
```

### 手動部署
在 Vercel Dashboard 中點擊 "Redeploy"

## 📈 擴展功能

### 1. 增加 AI 模型
在 `src/app/actions.ts` 中添加新的模型：
```typescript
const modelsToTry = [
  'gemini-3-flash-preview', 
  'gemini-2.5-flash', 
  'gemini-2.5-pro',
  'your-new-model'  // 添加新模型
];
```

### 2. 自定義使用限制
修改 `src/app/api/user-usage/route.ts` 中的預設值

### 3. 添加新的管理員
在 `src/app/admin/page.tsx` 中更新管理員列表

這樣就完成了完整的部署設置！