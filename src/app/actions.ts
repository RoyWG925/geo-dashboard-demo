// src/app/actions.ts
'use server';

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { ApifyClient } from 'apify-client';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/utils/supabase/server'; 

export interface GeoAnalysisResult {
  keyword: string;
  paa: string[];
  content: string; 
  draftContent?: string; 
  status: 'success' | 'error';
  errorMessage?: string;
  usedModel?: string;
}

// 1. 讀取 Excel (無數量限制)
export async function getKeywordsFromExcel() {
  try {
    const filePath = path.join(process.cwd(), 'data.xlsx'); 
    if (!fs.existsSync(filePath)) return ["Error: Excel_Not_Found"];
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; 
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    // @ts-ignore
    return data.map(row => row.Keyword).filter(k => k) as string[];
  } catch (error) {
    console.error("Excel Error:", error);
    return [];
  }
}

// 2. 檢查用戶使用次數
export async function checkUserUsage() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('請先登入');
    }

    const { data: usage, error } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // 如果沒有記錄，創建新記錄
    if (!usage) {
      const { data: newUsage, error: insertError } = await supabase
        .from('user_usage')
        .insert({
          user_id: user.id,
          email: user.email,
          usage_count: 0,
          max_usage: 10,
          is_premium: false
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newUsage;
    }

    return usage;
  } catch (error: any) {
    throw new Error(`使用次數檢查失敗: ${error.message}`);
  }
}

// 3. 執行 GEO Pipeline
export async function runGeoPipeline(keyword: string): Promise<GeoAnalysisResult> {
  console.log(`🚀 開始執行 GEO Pipeline: ${keyword}`);
  const supabase = await createClient();
  let usedModel = "";

  // 檢查用戶認證和使用次數
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { keyword, paa: [], content: "", status: 'error', errorMessage: '請先登入系統' };
    }

    const usage = await checkUserUsage();
    
    // 檢查是否超過限制
    if (usage.usage_count >= usage.max_usage && !usage.is_premium) {
      return { 
        keyword, 
        paa: [], 
        content: "", 
        status: 'error', 
        errorMessage: `您已達到使用次數上限 (${usage.usage_count}/${usage.max_usage})。請聯繫管理員以獲得更多使用次數。聯繫信箱：jg971402@gmail.com` 
      };
    }

    // 增加使用次數
    await supabase
      .from('user_usage')
      .update({ 
        usage_count: usage.usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

  } catch (error: any) {
    return { keyword, paa: [], content: "", status: 'error', errorMessage: error.message };
  }

  // --- A. Apify PAA (資料蒐集) ---
  let paaQuestions: string[] = [];
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error("Missing APIFY_API_TOKEN");

    const client = new ApifyClient({ token: token });
    const run = await client.actor("apify/google-search-scraper").call({
      queries: keyword, 
      countryCode: "tw",
      maxPagesPerQuery: 1,     
      resultsPerPage: 5,       
      saveHtml: false,
      saveJson: true,
      mobileResults: true,   
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (items.length > 0) {
      // @ts-ignore
      const rawPaa = items[0].peopleAlsoAsk || [];
      if (Array.isArray(rawPaa)) {
        // @ts-ignore
        paaQuestions = rawPaa.map(p => p.question).filter(q => q);
      }
    }
  } catch (error: any) {
    console.error("❌ Apify 失敗:", error.message);
    return { keyword, paa: [], content: "", status: 'error', errorMessage: error.message };
  }

  // --- B. AI Pipeline (重點修改區域) ---
  let draftContent = "";
  let finalContent = "";

  const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'];

  try {
    // 步驟 1: LLM 原始回答 (Raw Generation)
    const paaContext = paaQuestions.length > 0 
      ? `Real User Questions (PAA): ${paaQuestions.join(', ')}` 
      : `Note: No PAA data found. Infer user intent from keyword directly.`;

    const draftPrompt = `
      Task: Provide a detailed, factual answer for the keyword: "${keyword}".
      Context: ${paaContext}
      Requirement: Output in Traditional Chinese (Taiwan).
      Goal: Detailed, factual response without specific formatting constraints.
    `;

    for (const modelId of modelsToTry) {
      try {
        console.log(`🤖 Stage 1 (Drafting) using: ${modelId}...`);
        const { text } = await generateText({
          model: google(modelId),
          prompt: draftPrompt,
        });
        draftContent = text;
        usedModel = modelId;
        break; 
      } catch (e: any) {
        console.warn(`⚠️ ${modelId} failed: ${e.message}`);
        if (modelId === modelsToTry[modelsToTry.length - 1]) throw e;
      }
    }

    // 步驟 2: GEO Optimization (採納專業級建議)
    const refinePrompt = `
      你是一個專業的 **GEO (Generative Engine Optimization) 專家**。

      **任務目標：**
      將原始內容重新改寫，使其符合 AI 搜尋引擎（如 ChatGPT Search、Google AI Overviews、Perplexity）偏好的內容格式。

      **ChatGPT 偏好的內容格式範例：**
      * **慢性腎臟病患者：** 高濃度的**鉀離子**與蛋白質會增加腎臟過濾負擔。
      * **痛風患者：** 屬於高普林濃縮肉汁，發作期飲用可能加劇尿酸控制問題。
      * **楓糖尿症 (MSUD) 患者：** 無法代謝滴雞精中豐富的**支鏈胺基酸 (BCAA)**。
      * **高血壓患者：** 需注意部分產品的**鈉含量**，建議優先選擇低鈉款式。
      * **2 歲以下幼兒：** 器官發育未完全，過多蛋白質與礦物質恐造成負擔。

      **AI 偏好的內容原則：**
      1. **可掃描性：** 使用項目符號和**粗體關鍵字**
      2. **直接性：** 採用 BLUF (Bottom Line Up Front) 原則，重點先說
      3. **結構化：** 使用清晰的 H2 / H3 層次結構
      4. **決策導向：** 適當使用表格進行比較

      **原始內容：**
      ${draftContent}

      **嚴格要求：**
      - **語言：** 繁體中文（台灣）
      - **格式：** 僅使用 Markdown
      - **開頭：** 以不超過 80 個中文字的 BLUF 摘要開始
      - **項目符號：** 大量使用 * 或 - 配合**粗體關鍵字**
      - **表格：** 包含至少一個 Markdown 比較表格（最少 3 欄）
      - **完整性：** 如缺乏具體產品資料，進行概念性比較，**絕不編造細節**

      請按照上述格式重新改寫內容：
    `;

    console.log(`✨ Stage 2 (GEO Refining) using: ${usedModel}...`);
    const { text: refinedText } = await generateText({
      model: google(usedModel),
      prompt: refinePrompt,
    });

    finalContent = refinedText;

  } catch (error: any) {
    return { keyword, paa: paaQuestions, content: "", status: 'error', errorMessage: error.message };
  }

  // --- C. Supabase Write ---
  try {
    const { error } = await supabase.from('geo_analysis_results').insert({
      keyword: keyword,
      paa_questions: paaQuestions, 
      geo_optimized_content: finalContent
    });
    if (error) console.error("Supabase Error:", error);
  } catch (e) { console.error("DB Error:", e); }

  return {
    keyword, paa: paaQuestions, content: finalContent, draftContent, status: 'success', usedModel
  };
}