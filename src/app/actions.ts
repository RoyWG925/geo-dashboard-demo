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

// 🔥 新增：獲取用戶的自定義關鍵字
export async function getUserKeywords(): Promise<string[]> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_keywords')
      .select('keyword')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user keywords:', error);
      return [];
    }

    return data?.map(item => item.keyword) || [];
  } catch (error) {
    console.error('Error fetching user keywords:', error);
    return [];
  }
}

// 🔥 新增：添加用戶自定義關鍵字
export async function addUserKeyword(keyword: string): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: '請先登入' };
    }

    // 檢查是否為 Premium 用戶
    const { data: usage } = await supabase
      .from('user_usage')
      .select('is_premium')
      .eq('user_id', user.id)
      .single();

    if (!usage?.is_premium) {
      return { success: false, message: '普通用戶無法新增關鍵字。請聯繫管理員升級為 Premium 用戶。' };
    }

    // 驗證關鍵字
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      return { success: false, message: '關鍵字不能為空' };
    }

    if (trimmedKeyword.length > 100) {
      return { success: false, message: '關鍵字長度不能超過 100 個字符' };
    }

    // 插入關鍵字（如果已存在會因為 UNIQUE 約束而失敗）
    const { error } = await supabase
      .from('user_keywords')
      .insert({
        user_id: user.id,
        keyword: trimmedKeyword
      });

    if (error) {
      if (error.code === '23505') { // UNIQUE violation
        return { success: false, message: '此關鍵字已存在' };
      }
      console.error('Failed to add keyword:', error);
      return { success: false, message: '新增失敗，請稍後再試' };
    }

    return { success: true, message: '關鍵字新增成功' };
  } catch (error) {
    console.error('Error adding keyword:', error);
    return { success: false, message: '系統錯誤，請稍後再試' };
  }
}

// 🔥 新增：刪除用戶自定義關鍵字
export async function deleteUserKeyword(keyword: string): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: '請先登入' };
    }

    const { error } = await supabase
      .from('user_keywords')
      .delete()
      .eq('user_id', user.id)
      .eq('keyword', keyword);

    if (error) {
      console.error('Failed to delete keyword:', error);
      return { success: false, message: '刪除失敗，請稍後再試' };
    }

    return { success: true, message: '關鍵字已刪除' };
  } catch (error) {
    console.error('Error deleting keyword:', error);
    return { success: false, message: '系統錯誤，請稍後再試' };
  }
}

// 🔥 新增：獲取用戶的分析歷史紀錄
export async function getAnalysisHistory(limit: number = 20): Promise<Array<{
  id: string;
  keyword: string;
  paa_questions: string[];
  geo_optimized_content: string;
  created_at: string;
}>> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return [];
    }

    // 從 geo_analysis_results 表獲取歷史紀錄
    // 注意：這個表目前沒有 user_id，所以會返回所有記錄
    // 如果需要按用戶過濾，需要修改表結構
    const { data, error } = await supabase
      .from('geo_analysis_results')
      .select('id, keyword, paa_questions, geo_optimized_content, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch analysis history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching analysis history:', error);
    return [];
  }
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
    // @ts-expect-error - XLSX data structure is dynamic
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    throw new Error(`使用次數檢查失敗: ${errorMessage}`);
  }
}

// 3. 執行 GEO Pipeline
export async function runGeoPipeline(
  keyword: string, 
  selectedModel?: string,
  customPrompt?: string,
  forceRefresh?: boolean
): Promise<GeoAnalysisResult> {
  console.log(`🚀 開始執行 GEO Pipeline: ${keyword}`);
  const supabase = await createClient();
  const usedModel = selectedModel || "gemini-2.5-flash";

  // 🔥 新增：資料庫快取檢查
  if (!forceRefresh) {
    try {
      console.log(`🔍 檢查資料庫快取: ${keyword}`);
      const { data: cachedResult, error: cacheError } = await supabase
        .from('geo_analysis_results')
        .select('*')
        .eq('keyword', keyword)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!cacheError && cachedResult) {
        console.log(`✅ 找到快取資料，直接返回 (節省成本)`);
        return {
          keyword,
          paa: cachedResult.paa_questions || [],
          content: cachedResult.geo_optimized_content || '',
          status: 'success',
          usedModel: 'cached',
          draftContent: cachedResult.geo_optimized_content || ''
        };
      }
    } catch {
      console.log(`⚠️ 快取檢查失敗，繼續執行完整流程`);
    }
  }

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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '認證失敗';
    return { keyword, paa: [], content: "", status: 'error', errorMessage };
  }

  // --- A. Apify PAA (資料蒐集) ---
  let paaQuestions: string[] = [];
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error("Missing APIFY_API_TOKEN");

    console.log(`🔍 [Apify] 開始爬取關鍵字: ${keyword}`);

    const client = new ApifyClient({ token: token });
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Apify 執行失敗';
    console.error("❌ [Apify] 失敗:", errorMessage);
    console.error("❌ [Apify] 完整錯誤:", error);
    return { keyword, paa: [], content: "", status: 'error', errorMessage };
  }

  // --- B. AI Pipeline (重點修改區域) ---
  let draftContent = "";
  let finalContent = "";

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

    console.log(`🤖 Stage 1 (Drafting) using: ${usedModel}...`);
    const { text } = await generateText({
      model: google(usedModel),
      prompt: draftPrompt,
    });
    draftContent = text;

    // 步驟 2: GEO Optimization (採納專業級建議)
    const defaultRefinePrompt = `
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

    // 🔥 新增：支援自定義 Prompt
    const finalRefinePrompt = customPrompt 
      ? `${customPrompt}\n\n**原始內容：**\n${draftContent}\n\n請按照上述要求重新改寫內容：`
      : defaultRefinePrompt;

    console.log(`✨ Stage 2 (GEO Refining) using: ${usedModel}...`);
    if (customPrompt) {
      console.log(`🎨 使用自定義 Prompt`);
    }
    
    const { text: refinedText } = await generateText({
      model: google(usedModel),
      prompt: finalRefinePrompt,
    });

    finalContent = refinedText;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'AI 生成失敗';
    return { keyword, paa: paaQuestions, content: "", status: 'error', errorMessage };
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