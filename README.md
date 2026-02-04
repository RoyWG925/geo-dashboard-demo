# GEO Analytics Dashboard - 改進版

這是一個基於 Next.js 的 GEO (Generative Engine Optimization) 分析儀表板，根據面試官建議進行了全面改進。

## 🆕 新增功能

### 1. 內容格式優化
- 採用 ChatGPT 偏好的內容格式
- 使用粗體關鍵字、項目符號、表格結構
- 符合 BLUF (Bottom Line Up Front) 原則

### 2. 微調功能
- 用戶可以對 AI 生成的內容進行人工校正
- 支持自定義修改提示詞
- 實時內容優化和調整

### 3. Supabase 認證系統
- **Gmail 登入**：支持 Google OAuth 登入
- **Email/密碼登入**：傳統登入方式
- **特定帳號設定**：管理員可設定特殊權限帳號
- **使用次數限制**：每個用戶有固定使用次數
- **Premium 會員**：可設定無限制使用

### 4. 功能鎖定機制
- 超過使用次數後無法新增關鍵字
- 無法執行 GEO 分析
- 顯示聯繫管理員信息

## 🚀 快速開始

### 1. 環境設置

```bash
# 安裝依賴
npm install

# 設置環境變數
cp .env.local.example .env.local
```

### 2. 環境變數配置

在 `.env.local` 中設置：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google AI 配置
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Apify 配置
APIFY_API_TOKEN=your_apify_token
```

### 3. Supabase 資料庫設置

1. 在 Supabase 中執行 `supabase-schema.sql` 腳本
2. 啟用 Google OAuth 認證
3. 設置認證回調 URL：`https://your-domain.com/auth/callback`

### 4. 啟動開發服務器

```bash
npm run dev
```

## 📊 功能說明

### 主要功能

1. **關鍵字分析**
   - 從 Excel 文件讀取關鍵字
   - 手動新增關鍵字（需要使用次數）
   - Apify Google 搜尋爬取 PAA 數據

2. **AI 內容生成**
   - 使用 Google Gemini 模型
   - 兩階段生成：原始回答 + GEO 優化
   - 符合 ChatGPT 偏好格式

3. **內容微調**
   - 用戶可提供修改建議
   - AI 根據建議重新優化內容
   - 保存微調歷史記錄

4. **使用次數管理**
   - 每個用戶預設 10 次使用機會
   - Premium 用戶可無限使用
   - 管理員可調整用戶權限

### 管理功能

訪問 `/admin` 頁面（需要管理員權限）：

- 查看所有用戶使用狀況
- 調整用戶使用次數上限
- 設定 Premium 會員
- 重置用戶使用次數

## 🔐 權限設置

### 管理員帳號（解鎖全部功能）

- **Google 登入**：`jg971402@gmail.com`
- **Email/密碼登入**：`dustin@growthmarketing.tw` / `123456`

管理員帳號自動獲得：
- 無限使用次數 (999999)
- Premium 會員權限
- 管理後台存取權限 (`/admin`)

### 普通用戶

- **測試帳號**：`123456@gmail.com` / `123456`

普通用戶權限：
- 預設 10 次使用機會
- 可使用所有基本功能
- 超過限制後需聯繫管理員

## 📱 使用流程

1. **登入系統**
   - 管理員：Google 登入 `jg971402@gmail.com` 或 Email `dustin@growthmarketing.tw` / `123456`
   - 普通用戶：`123456@gmail.com` / `123456`
   - 系統自動創建用戶使用記錄

2. **選擇關鍵字**
   - 從 Excel 清單選擇
   - 或手動新增新關鍵字

3. **執行分析**
   - 點擊「執行 GEO 分析」
   - 系統爬取 PAA 數據並生成優化內容

4. **微調內容**
   - 點擊「微調內容」
   - 輸入修改建議
   - 獲得優化後的內容

## 🛠️ 技術架構

- **前端**：Next.js 14, React 19, TypeScript
- **UI**：Tailwind CSS, Recharts
- **後端**：Next.js API Routes
- **資料庫**：Supabase (PostgreSQL)
- **認證**：Supabase Auth (Google OAuth + Email)
- **AI**：Google Gemini (多模型備援)
- **爬蟲**：Apify Google Search Scraper

## 📈 部署

### Vercel 部署

```bash
# 連接 Vercel
vercel

# 設置環境變數
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add GOOGLE_GENERATIVE_AI_API_KEY
vercel env add APIFY_API_TOKEN

# 部署
vercel --prod
```

### Supabase 設置

1. 在 Supabase Dashboard 中：
   - 執行 SQL 腳本創建表格
   - 啟用 Google OAuth
   - 設置域名白名單

2. 認證設置：
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`

## 🔧 自定義設置

### 調整使用次數限制

在 `src/app/api/user-usage/route.ts` 中修改：

```typescript
max_usage: 10, // 改為你想要的預設次數
```

### 新增管理員

在 `src/app/admin/page.tsx` 中修改：

```typescript
const adminEmails = ['admin@example.com', 'your-admin@email.com'];
```

### 自定義 AI Prompt

在 `src/app/actions.ts` 中修改 `refinePrompt` 變數。

## 📞 聯繫方式

當用戶超過使用次數時，系統會顯示聯繫信息：
- 管理員信箱：jg971402@gmail.com

可在相關文件中修改此信息。

## 🎯 面試官建議實現狀況

✅ **內容格式優化**：採用 ChatGPT 偏好格式，使用粗體、項目符號、表格
✅ **微調功能**：支持人工 prompt 校正，如移除特定建議
✅ **Gmail 登入**：完整的 Google OAuth 整合
✅ **特定帳號設定**：管理員可設定特殊權限帳號
✅ **使用次數限制**：超過次數後鎖定功能，顯示聯繫信息
✅ **功能鎖定**：無法新增關鍵字，需要來信詢問

所有建議功能已完整實現！