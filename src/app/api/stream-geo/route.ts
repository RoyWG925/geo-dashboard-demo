import { createClient } from '@/utils/supabase/server';
import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { ApifyClient } from 'apify-client';

// 移除 edge runtime，使用預設的 Node.js runtime
// export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 檢查用戶認證
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { keyword, selectedModel, customPrompt, forceRefresh } = await request.json();

    if (!keyword) {
      return new Response('Missing keyword', { status: 400 });
    }

    const usedModel = selectedModel || 'gemini-2.5-flash';

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
        // 返回快取內容（非串流）
        return new Response(
          JSON.stringify({
            type: 'cached',
            content: cachedResult.geo_optimized_content,
            paa: cachedResult.paa_questions
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 執行 Apify 爬蟲
    let paaQuestions: string[] = [];
    try {
      const token = process.env.APIFY_API_TOKEN;
      if (token) {
        console.log(`🔍 [Apify] 開始爬取關鍵字: ${keyword}`);
        
        const client = new ApifyClient({ token });
        const run = await client.actor("apify/google-search-scraper").call({
          queries: keyword,
          countryCode: "tw",
          languageCode: "zh-TW",
          maxPagesPerQuery: 1,
          resultsPerPage: 10,  // 增加到 10 個結果
          saveHtml: false,
          saveJson: true,
          mobileResults: false,  // 改用桌面版（PAA 更穩定）
          includeUnfilteredResults: true,
        });

        console.log(`✅ [Apify] 爬蟲執行完成，Run ID: ${run.id}`);

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        console.log(`📊 [Apify] 獲得 ${items.length} 個結果項目`);

        if (items.length > 0) {
          const firstItem = items[0];
          console.log(`🔍 [Apify] 檢查 PAA 數據...`);
          
          const rawPaa = firstItem.peopleAlsoAsk || [];
          
          if (Array.isArray(rawPaa) && rawPaa.length > 0) {
            console.log(`📝 [Apify] 找到 ${rawPaa.length} 個原始 PAA 項目`);
            
            paaQuestions = rawPaa
              .map(p => {
                // 嘗試多種可能的屬性名稱
                return p.question || p.title || p.text || p.query || '';
              })
              .filter(q => q && q.trim().length > 0);
            
            console.log(`✅ [Apify] 成功提取 ${paaQuestions.length} 個 PAA 問題`);
            
            if (paaQuestions.length > 0) {
              console.log(`📋 [Apify] PAA 問題:`);
              paaQuestions.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));
            }
          } else {
            console.warn(`⚠️ [Apify] 此關鍵字沒有 PAA 數據`);
          }
        } else {
          console.warn(`⚠️ [Apify] 沒有獲得任何搜尋結果`);
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '未知錯誤';
      console.error('❌ [Apify] 失敗:', errorMessage);
      console.error('❌ [Apify] 完整錯誤:', e);
    }

    // 準備 Prompt
    const paaContext = paaQuestions.length > 0 
      ? `Real User Questions (PAA): ${paaQuestions.join(', ')}` 
      : `Note: No PAA data found. Infer user intent from keyword directly.`;

    const defaultPrompt = `
      你是一個專業的 **GEO (Generative Engine Optimization) 專家**。

      **任務目標：**
      為關鍵字「${keyword}」撰寫符合 AI 搜尋引擎（如 ChatGPT Search、Google AI Overviews、Perplexity）偏好的內容。

      **用戶搜尋意圖參考：**
      ${paaContext}

      **AI 偏好的內容原則：**
      1. **可掃描性：** 使用項目符號和**粗體關鍵字**
      2. **直接性：** 採用 BLUF (Bottom Line Up Front) 原則，重點先說
      3. **結構化：** 使用清晰的 H2 / H3 層次結構
      4. **決策導向：** 適當使用表格進行比較

      **嚴格要求：**
      - **語言：** 繁體中文（台灣）
      - **格式：** 僅使用 Markdown
      - **開頭：** 以不超過 80 個中文字的 BLUF 摘要開始
      - **項目符號：** 大量使用 * 或 - 配合**粗體關鍵字**
      - **表格：** 包含至少一個 Markdown 比較表格（最少 3 欄）
      - **完整性：** 如缺乏具體產品資料，進行概念性比較，**絕不編造細節**

      請按照上述格式撰寫內容：
    `;

    // 🔥 修復：如果使用自定義 Prompt，需要將關鍵字和 PAA 數據注入到自定義 Prompt 中
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

    // 🔥 使用 streamText 進行串流輸出
    const result = streamText({
      model: google(usedModel),
      prompt: finalPrompt,
      onFinish: async ({ text }) => {
        // 串流完成後保存到資料庫
        try {
          await supabase.from('geo_analysis_results').insert({
            keyword,
            paa_questions: paaQuestions,
            geo_optimized_content: text
          });
        } catch (e) {
          console.error('Failed to save to database:', e);
        }
      }
    });

    // 使用 toTextStreamResponse
    const response = result.toTextStreamResponse();
    
    // 🔥 使用 Base64 編碼來傳遞中文 PAA 問題
    if (paaQuestions.length > 0) {
      try {
        const paaBase64 = Buffer.from(JSON.stringify(paaQuestions), 'utf-8').toString('base64');
        response.headers.set('X-PAA-Questions-Base64', paaBase64);
      } catch (e) {
        console.error('Failed to encode PAA questions:', e);
      }
    }
    
    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('Stream error:', error);
    return new Response(errorMessage, { status: 500 });
  }
}
