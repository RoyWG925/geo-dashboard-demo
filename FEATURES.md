# GEO Dashboard 功能說明

## 核心功能

### 1. GEO 內容分析
- 使用 Google Gemini AI 生成符合 GEO 標準的內容
- 支援三種 AI 模型選擇：
  - Gemini 3 Flash
  - Gemini 2.5 Flash（預設）
  - Gemini 2.5 Flash Lite

### 2. PAA (People Also Ask) 數據抓取
- 使用 Apify Google Search Scraper 自動抓取相關問題
- 支援繁體中文（台灣）搜尋結果
- 自動整合到 AI 生成內容中

### 3. 串流輸出 (Streaming UI)
- 即時顯示 AI 生成內容
- 類似 ChatGPT 的逐字顯示效果
- 改善用戶等待體驗

### 4. 資料庫快取
- 自動檢查是否已有分析結果
- 避免重複呼叫 API，節省成本
- 可選擇強制重新生成

### 5. 用戶自定義關鍵字
- Premium 用戶可新增自定義關鍵字
- 關鍵字持久化保存到資料庫
- 支援刪除自定義關鍵字
- 自定義關鍵字以 ★ 標記

### 6. 分析歷史紀錄
- 查看最近 20 筆分析記錄
- 快速載入歷史結果
- 卡片式布局顯示

### 7. Prompt 實驗室
- 支援自定義 AI Prompt
- 預設使用最佳實踐 Prompt
- 適合不同產品線調整語氣

### 8. 內容微調
- 對已生成的內容進行二次優化
- 支援自定義微調指令
- 保留原始 PAA 數據

## 技術特點

### UTF-8 Base64 編碼
- 正確處理中文 PAA 問題
- 使用 Base64 編碼傳遞 HTTP Header
- 前端使用 `decodeURIComponent()` 正確解碼

### 權限控制
- 普通用戶：每日 5 次分析
- Premium 用戶：無限次分析 + 自定義關鍵字
- 管理員：jg971402@gmail.com

### 資料視覺化
- 使用 Recharts 顯示 PAA 數量統計
- 即時更新分析狀態
- 系統日誌記錄

## 使用流程

1. **登入系統**
   - 使用 Supabase 認證
   - 自動檢查使用次數

2. **選擇關鍵字**
   - 從清單選擇或新增自定義關鍵字
   - 可使用搜尋過濾

3. **執行分析**
   - 選擇 AI 模型
   - 可選擇自定義 Prompt
   - 可選擇強制重新生成

4. **查看結果**
   - 即時串流顯示內容
   - 查看 PAA 問題
   - 檢查 GEO 合規性

5. **內容微調**（選填）
   - 輸入微調指令
   - 重新生成優化內容

## 環境變數

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyBnjuMLlwXXj_pGhWTWYHk56m8KQ5IpC2Q

# Apify
APIFY_API_TOKEN=your_apify_token
```

## 資料庫表格

### geo_analysis_results
- 儲存分析結果
- 包含 PAA 問題和生成內容
- 用於快取機制

### user_keywords
- 儲存用戶自定義關鍵字
- 僅 Premium 用戶可新增
- 支援 RLS 權限控制

### user_usage
- 追蹤用戶使用次數
- 區分普通/Premium 用戶
- 每日重置計數

## 已知問題與解決方案

### PAA 數據抓取不穩定
**解決方案**:
- 增加 `resultsPerPage` 到 10
- 使用桌面版搜尋結果
- 添加詳細日誌記錄

### 中文 PAA 顯示亂碼
**解決方案**:
- 使用 Base64 編碼傳遞
- 前端使用 `decodeURIComponent()` 解碼
- 詳見 `UTF8_BASE64_FIX.md`

### Edge Runtime 不支援 Apify
**解決方案**:
- 移除 `export const runtime = 'edge'`
- 使用預設 Node.js runtime

## 相關文件
- `README.md` - 專案概述
- `SETUP_GUIDE.md` - 安裝設定指南
- `DEPLOYMENT.md` - 部署說明
- `SUPABASE_SETUP.md` - Supabase 設定
- `UTF8_BASE64_FIX.md` - UTF-8 編碼修復詳解
