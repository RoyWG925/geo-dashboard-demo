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

// 1. 讀取 Excel (保持不變)
export async function getKeywordsFromExcel() {
  try {
    const filePath = path.join(process.cwd(), 'data.xlsx'); 
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 找不到檔案: ${filePath}`);
      return ["Error: Excel_Not_Found"];
    }
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; 
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    // @ts-ignore
    return data.map(row => row.Keyword).filter(k => k).slice(0, 5) as string[];
  } catch (error) {
    console.error("❌ Excel 讀取失敗:", error);
    return [];
  }
}

// 2. 執行 GEO Pipeline
export async function runGeoPipeline(keyword: string): Promise<GeoAnalysisResult> {
  console.log(`🚀 開始執行 GEO Pipeline: ${keyword}`);
  const supabase = await createClient();
  let usedModel = "";

  // --- A. Apify PAA ---
  let paaQuestions: string[] = [];
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error("Missing APIFY_API_TOKEN");

    const client = new ApifyClient({ token: token });
    // 使用官方 google-search-scraper
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
    
    if (paaQuestions.length === 0) {
       console.warn(`⚠️ 警告: 關鍵字 "${keyword}" 未抓取到 PAA`);
    }

  } catch (error: any) {
    console.error("❌ Apify 失敗:", error.message);
    return {
        keyword, paa: [], content: "", status: 'error',
        errorMessage: `Apify Failed: ${error.message}`
    };
  }

  // --- B. AI Pipeline (根據 2026/02 最新情報修正) ---
  let draftContent = "";
  let finalContent = "";

  // 🟢 關鍵修正：根據你提供的最新情報，使用免費 Tier 支援的模型
  const modelsToTry = [
    'gemini-3-flash-preview',  // 首選：最新、最快、免費
    'gemini-2.5-flash',        // 備援：穩定版
    'gemini-2.5-pro',          // 最後手段：免費但有限制
  ];

  try {
    const paaContext = paaQuestions.length > 0 
      ? `Real User Questions (PAA): ${paaQuestions.join(', ')}` 
      : `Note: No PAA data found. Infer user intent from keyword directly.`;

    // Stage 1: Drafting (生成初稿)
    const draftPrompt = `
      Task: Generate a comprehensive answer for: "${keyword}".
      Context: ${paaContext}
      Goal: Detailed, factual response.
      Tone: Helpful and authoritative.
    `;

    for (const modelId of modelsToTry) {
      try {
        console.log(`🤖 Stage 1 using: ${modelId}...`);
        const { text } = await generateText({
          model: google(modelId),
          prompt: draftPrompt,
        });
        draftContent = text;
        usedModel = modelId;
        break; // 成功就跳出
      } catch (e: any) {
        console.warn(`⚠️ ${modelId} failed: ${e.message}`);
        if (modelId === modelsToTry[modelsToTry.length - 1]) throw e;
      }
    }

    // Stage 2: Refining (GEO 優化)
    // 雖然是用 Flash 模型，我們透過 Prompt 讓它扮演 GEO 專家
    const refinePrompt = `
      You are an expert in GEO (Generative Engine Optimization).
      Your task is to rewrite the content to be favored by AI search engines (like Gemini 3 Pro).

      **Source Content:**
      ${draftContent}

      **Strict Optimization Rules:**
      1. **BLUF:** Start with a direct answer in < 40 words.
      2. **Structure:** Use clear H2/H3 headings.
      3. **Visuals:** You MUST create a Markdown Comparison Table.
      4. **Lists:** Use bullet points for readability.
    `;

    console.log(`✨ Stage 2 using: ${usedModel}...`);
    const { text: refinedText } = await generateText({
      model: google(usedModel), // 沿用剛剛成功的模型
      prompt: refinePrompt,
    });

    finalContent = refinedText;

  } catch (error: any) {
    console.error("❌ AI Pipeline 失敗:", error);
    return {
        keyword, paa: paaQuestions, content: "", status: 'error',
        errorMessage: `AI Failed: ${error.message}`
    };
  }

  // --- C. Supabase Write ---
  try {
    const { error } = await supabase
      .from('geo_analysis_results')
      .insert({
        keyword: keyword,
        paa_questions: paaQuestions, 
        geo_optimized_content: finalContent
      });

    if (error) console.error("Supabase Error:", error);
  } catch (e) { console.error("DB Error:", e); }

  return {
    keyword,
    paa: paaQuestions,
    content: finalContent,
    draftContent: draftContent,
    status: 'success',
    usedModel: usedModel
  };
}