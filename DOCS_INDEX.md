# 📚 文檔索引

快速找到你需要的資訊！

## 🎯 我想要...

### 開始使用系統
→ **README.md** - 專案概述、快速開始、基本使用流程

### 安裝和設定
→ **SETUP_GUIDE.md** - 詳細的安裝步驟、環境變數設定、常見問題

### 設定資料庫
→ **SUPABASE_SETUP.md** - Supabase 完整設定指南
→ **complete-supabase-setup.sql** - 執行此腳本創建所有表格
→ **user-keywords-schema.sql** - 用戶關鍵字表格（單獨執行）

### 部署到生產環境
→ **DEPLOYMENT.md** - Vercel 部署步驟、環境變數設定

### 了解系統功能
→ **FEATURES.md** - 完整功能列表、技術特點、使用流程

### 解決中文亂碼問題
→ **UTF8_BASE64_FIX.md** - UTF-8 Base64 編碼技術文檔、問題排查

## 📁 文檔清單

### Markdown 文檔（6 個）

| 文檔 | 用途 | 適合對象 |
|------|------|----------|
| **README.md** | 專案概述與快速開始 | 所有人 |
| **FEATURES.md** | 完整功能說明 | 開發者、產品經理 |
| **SETUP_GUIDE.md** | 安裝設定指南 | 開發者 |
| **DEPLOYMENT.md** | 部署說明 | DevOps、開發者 |
| **SUPABASE_SETUP.md** | 資料庫設定 | 開發者、DBA |
| **UTF8_BASE64_FIX.md** | 技術文檔（編碼問題） | 開發者 |

### SQL 腳本（2 個）

| 腳本 | 用途 | 執行時機 |
|------|------|----------|
| **complete-supabase-setup.sql** | 創建所有表格和權限 | 首次設定 |
| **user-keywords-schema.sql** | 創建用戶關鍵字表格 | 首次設定或更新 |

## 🔍 常見問題快速查找

### 安裝相關
- **如何安裝依賴？** → README.md > 快速開始
- **環境變數怎麼設定？** → SETUP_GUIDE.md > 環境變數配置
- **Supabase 怎麼設定？** → SUPABASE_SETUP.md

### 功能相關
- **有哪些功能？** → FEATURES.md > 核心功能
- **如何新增關鍵字？** → FEATURES.md > 用戶自定義關鍵字
- **如何查看歷史紀錄？** → FEATURES.md > 分析歷史紀錄
- **什麼是 Prompt 實驗室？** → FEATURES.md > Prompt 實驗室

### 問題排查
- **PAA 問題顯示亂碼？** → UTF8_BASE64_FIX.md
- **無法新增關鍵字？** → SETUP_GUIDE.md > 常見問題
- **串流輸出不正常？** → FEATURES.md > 已知問題與解決方案
- **資料庫表格不存在？** → SUPABASE_SETUP.md > 執行 SQL 腳本

### 部署相關
- **如何部署到 Vercel？** → DEPLOYMENT.md
- **環境變數怎麼設定？** → DEPLOYMENT.md > 環境變數
- **如何設定域名？** → DEPLOYMENT.md > 域名設定

## 📊 文檔關係圖

```
README.md (入口)
├── SETUP_GUIDE.md (詳細安裝)
│   └── SUPABASE_SETUP.md (資料庫設定)
│       ├── complete-supabase-setup.sql
│       └── user-keywords-schema.sql
├── FEATURES.md (功能說明)
│   └── UTF8_BASE64_FIX.md (技術細節)
└── DEPLOYMENT.md (部署)
```

## 🎓 學習路徑

### 新手（第一次使用）
1. README.md - 了解專案
2. SETUP_GUIDE.md - 安裝設定
3. SUPABASE_SETUP.md - 設定資料庫
4. 執行 SQL 腳本
5. 開始使用！

### 開發者（想了解技術細節）
1. README.md - 專案概述
2. FEATURES.md - 功能架構
3. UTF8_BASE64_FIX.md - 技術實現
4. 查看原始碼

### 部署人員（準備上線）
1. README.md - 確認需求
2. DEPLOYMENT.md - 部署步驟
3. SUPABASE_SETUP.md - 生產環境資料庫
4. 設定環境變數
5. 部署！

## 💡 提示

- 📖 **從 README.md 開始** - 這是最好的入口
- 🔍 **使用 Ctrl+F 搜尋** - 在文檔中快速找到關鍵字
- 📝 **按順序閱讀** - 文檔之間有邏輯關係
- ❓ **遇到問題先查文檔** - 大部分問題都有解答

## 🗂️ 文檔維護

### 已刪除的文檔（不再需要）
- ~~ESLINT_FIX_LOG.md~~ - 已完成
- ~~PAA_DEBUGGING.md~~ - 問題已解決
- ~~AUTHENTICATION_TROUBLESHOOTING.md~~ - 已解決
- ~~FINAL_IMPROVEMENTS.md~~ - 內容已整合
- ~~ADVANCED_FEATURES.md~~ - 內容已整合到 FEATURES.md
- ~~STREAMING_FIX.md~~ - 內容已整合
- ~~USER_KEYWORDS_FEATURE.md~~ - 內容已整合到 FEATURES.md
- ~~MODEL_SELECTION_FEATURE.md~~ - 內容已整合
- ~~PAA_TEST_GUIDE.md~~ - 不再需要
- ~~SIMPLE_TEST_GUIDE.md~~ - 不再需要
- ~~CHINESE_HEADER_FIX.md~~ - 內容已整合到 UTF8_BASE64_FIX.md

### 已刪除的 SQL 腳本（不再需要）
- ~~supabase-schema.sql~~ - 已有完整版本
- ~~setup-final-accounts.sql~~ - 內容已整合
- ~~update-test-account.sql~~ - 已不需要
- ~~setup-test-accounts.sql~~ - 已不需要
- ~~fix-auth-issues.sql~~ - 已解決

---

**最後更新**: 2026/2/6
**文檔總數**: 8 個（6 個 .md + 2 個 .sql）
