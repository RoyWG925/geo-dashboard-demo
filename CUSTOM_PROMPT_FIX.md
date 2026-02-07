# 自定義 Prompt 功能修復

## 問題描述

### Bug 1: 自定義 Prompt 忽略 PAA 數據
**問題**: 當用戶使用自定義 Prompt（例如：「語氣輕鬆，像說故事一樣」），系統會忽略爬取到的 PAA 問題，生成與 GEO 完全無關的文章。

**原因**: 原本的邏輯是 `const finalPrompt = customPrompt || defaultPrompt;`，直接使用用戶的 Prompt，沒有注入關鍵字和 PAA 數據。

**範例**:
```
用戶輸入: "語氣輕鬆 像說故事一樣"
關鍵字: "滴雞精"
PAA: ["滴雞精功效是什麼？", "滴雞精怎麼喝？"]

❌ 修復前: AI 只看到 "語氣輕鬆 像說故事一樣"，不知道要寫什麼主題
✅ 修復後: AI 看到完整指令，包含關鍵字和 PAA 問題
```

### Bug 2: 快取邏輯問題
**問題**: 使用自定義 Prompt 時，系統仍然返回快取的預設 Prompt 結果，導致用戶的自定義要求被忽略。

**原因**: 快取檢查只看 `forceRefresh`，沒有考慮 `customPrompt`。

**範例**:
```
第一次執行（預設 Prompt）:
- 關鍵字: "滴雞精"
- Prompt: 預設 GEO Prompt
- 結果: 符合 GEO 標準的內容（已快取）

第二次執行（自定義 Prompt）:
- 關鍵字: "滴雞精"
- Prompt: "語氣輕鬆 像說故事一樣"
- ❌ 修復前: 返回第一次的快取結果（GEO 格式）
- ✅ 修復後: 重新生成（輕鬆語氣）
```

## 解決方案

### 修復 1: 注入關鍵字和 PAA 到自定義 Prompt

**修復前**:
```typescript
const finalPrompt = customPrompt || defaultPrompt;
```

**修復後**:
```typescript
let finalPrompt: string;
if (customPrompt) {
  // 用戶自定義 Prompt，但仍需包含關鍵字和 PAA 數據
  finalPrompt = `
    你是一個專業的內容創作專家。

    **任務目標：**
    為關鍵字「${keyword}」撰寫內容。

    **用戶搜尋意圖參考（必須參考這些真實用戶問題）：**
    ${paaContext}

    **用戶自定義要求：**
    ${customPrompt}

    **基本要求：**
    - **語言：** 繁體中文（台灣）
    - **格式：** 使用 Markdown
    - **內容：** 必須回答關鍵字「${keyword}」相關的問題
    - **參考：** 必須參考上述的用戶搜尋意圖（PAA 問題）

    請按照用戶自定義要求撰寫內容：
  `;
} else {
  // 使用預設 Prompt
  finalPrompt = defaultPrompt;
}
```

### 修復 2: 自定義 Prompt 時跳過快取

**修復前**:
```typescript
// 檢查快取
if (!forceRefresh) {
  const { data: cachedResult } = await supabase
    .from('geo_analysis_results')
    .select('*')
    .eq('keyword', keyword)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (cachedResult) {
    // 返回快取內容
    return new Response(JSON.stringify({
      type: 'cached',
      content: cachedResult.geo_optimized_content,
      paa: cachedResult.paa_questions
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}
```

**修復後**:
```typescript
// 🔥 修復：如果使用自定義 Prompt，應該跳過快取
const shouldUseCache = !forceRefresh && !customPrompt;

// 檢查快取
if (shouldUseCache) {
  const { data: cachedResult } = await supabase
    .from('geo_analysis_results')
    .select('*')
    .eq('keyword', keyword)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (cachedResult) {
    // 返回快取內容
    return new Response(JSON.stringify({
      type: 'cached',
      content: cachedResult.geo_optimized_content,
      paa: cachedResult.paa_questions
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}
```

## 測試案例

### 測試 1: 自定義 Prompt 包含關鍵字和 PAA

**輸入**:
- 關鍵字: "滴雞精"
- PAA: ["滴雞精功效是什麼？", "滴雞精怎麼喝？", "滴雞精推薦品牌"]
- 自定義 Prompt: "語氣輕鬆，像說故事一樣"

**預期輸出**:
```markdown
# 滴雞精的故事

嘿！你知道嗎？滴雞精這個東西啊，其實超神奇的...

## 滴雞精功效是什麼？
讓我來跟你說說滴雞精的厲害之處...

## 滴雞精怎麼喝？
喝滴雞精其實很簡單...

## 滴雞精推薦品牌
市面上有很多品牌...
```

**驗證**:
- ✅ 語氣輕鬆（符合自定義要求）
- ✅ 包含關鍵字「滴雞精」
- ✅ 回答了 PAA 問題
- ✅ 使用繁體中文

### 測試 2: 自定義 Prompt 不使用快取

**步驟**:
1. 使用預設 Prompt 執行分析（關鍵字: "滴雞精"）
2. 等待結果並確認已快取
3. 使用自定義 Prompt 再次執行（關鍵字: "滴雞精"）

**預期結果**:
- ✅ 第一次: 生成 GEO 格式內容（項目符號、表格、粗體）
- ✅ 第二次: 重新生成，不使用快取，符合自定義語氣

### 測試 3: 預設 Prompt 仍然使用快取

**步驟**:
1. 使用預設 Prompt 執行分析（關鍵字: "滴雞精"）
2. 等待結果並確認已快取
3. 使用預設 Prompt 再次執行（關鍵字: "滴雞精"）

**預期結果**:
- ✅ 第一次: 生成內容並保存到資料庫
- ✅ 第二次: 立即返回快取內容（不重新生成）
- ✅ 日誌顯示: "✅ 使用快取資料 (節省成本)"

### 測試 4: 強制重新生成仍然有效

**步驟**:
1. 使用預設 Prompt 執行分析（關鍵字: "滴雞精"）
2. 勾選「強制重新生成」
3. 再次執行

**預期結果**:
- ✅ 即使有快取，仍然重新生成
- ✅ 日誌顯示: "🔄 強制重新生成 (不使用快取)"

## 快取邏輯決策表

| forceRefresh | customPrompt | 結果 |
|--------------|--------------|------|
| false | 無（預設） | ✅ 使用快取（如果存在） |
| false | 有自定義 | ✅ 跳過快取，重新生成 |
| true | 無（預設） | ✅ 跳過快取，重新生成 |
| true | 有自定義 | ✅ 跳過快取，重新生成 |

**邏輯公式**:
```typescript
const shouldUseCache = !forceRefresh && !customPrompt;
```

## 自定義 Prompt 範例

### 範例 1: 輕鬆語氣
```
語氣輕鬆，像說故事一樣，使用口語化的表達方式
```

**效果**: 內容會像朋友聊天一樣，但仍然包含關鍵字和 PAA 問題的答案。

### 範例 2: 專業醫療
```
使用專業醫療術語，嚴謹的科學語氣，引用研究數據
```

**效果**: 內容會更專業，適合醫療產品。

### 範例 3: 年輕活潑
```
使用年輕人的語言，加入流行用語和表情符號，活潑有趣
```

**效果**: 內容會更年輕化，適合零食、飲料等產品。

### 範例 4: 簡潔明瞭
```
每個段落不超過 3 句話，使用最簡單的詞彙，適合快速閱讀
```

**效果**: 內容會非常簡潔，適合忙碌的用戶。

### 範例 5: 詳細深入
```
提供詳細的背景知識，深入解釋原理，包含歷史脈絡
```

**效果**: 內容會更詳細，適合需要深入了解的用戶。

## 注意事項

### 1. 自定義 Prompt 的限制
- ✅ 可以調整語氣、風格、詳細程度
- ✅ 可以增加特殊要求（如表情符號、引用數據）
- ❌ 不能改變關鍵字（系統會自動注入）
- ❌ 不能忽略 PAA 問題（系統會自動注入）

### 2. 快取行為
- 預設 Prompt: 使用快取（節省成本）
- 自定義 Prompt: 不使用快取（確保符合自定義要求）
- 強制重新生成: 永遠不使用快取

### 3. 成本考量
- 使用快取: 免費（不消耗 API 額度）
- 重新生成: 消耗 API 額度
- 建議: 測試時使用預設 Prompt，確定後再使用自定義 Prompt

### 4. 最佳實踐
- 先用預設 Prompt 看看效果
- 如果需要調整，使用自定義 Prompt
- 自定義 Prompt 要明確具體
- 避免過於複雜的要求

## 相關文件
- `src/app/api/stream-geo/route.ts` - 後端 Prompt 處理邏輯
- `src/app/page.tsx` - 前端自定義 Prompt UI
- `FEATURES.md` - Prompt 實驗室功能說明

## 總結

通過這次修復，自定義 Prompt 功能現在可以：
- ✅ 正確包含關鍵字和 PAA 數據
- ✅ 跳過快取，確保符合自定義要求
- ✅ 保持預設 Prompt 的快取優化
- ✅ 提供靈活的內容創作能力

用戶現在可以放心使用自定義 Prompt，系統會確保生成的內容既符合自定義要求，又回答了用戶真正關心的問題（PAA）！🎉
