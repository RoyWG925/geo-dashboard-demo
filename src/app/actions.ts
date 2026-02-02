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

// 2. 執行 GEO Pipeline
export async function runGeoPipeline(keyword: string): Promise<GeoAnalysisResult> {
  console.log(`🚀 開始執行 GEO Pipeline: ${keyword}`);
  const supabase = await createClient();
  let usedModel = "";

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
      You are a **GEO (Generative Engine Optimization) Architect**.

      **Goal:**
      Rewrite the source content to match the preferred formats of AI Search Engines (e.g., ChatGPT Search, Google AI Overviews, Perplexity).

      **AI-Preferred Content Principles:**
      1. **Scannable:** Use bullet points and bold keywords.
      2. **Direct:** Apply the BLUF (Bottom Line Up Front) principle.
      3. **Structured:** Use clear H2 / H3 hierarchy.
      4. **Decision-Oriented:** Use tables for comparison when applicable.

      **Action:**
      Rewrite the source content by strictly applying the rules below.

      **Source Content:**
      ${draftContent}

      **Strict Constraints:**
      - **Language:** Traditional Chinese (Taiwan) / 繁體中文.
      - **Output Format:** Markdown only.
      - **Summary:** Start with a BLUF summary of **no more than 80 Chinese characters**.
      - **Table:** Include **exactly one Markdown comparison table** (minimum 3 columns: Aspect / Option A / Option B or equivalent).
      - **Integrity:** If specific products or data are missing, perform **conceptual comparison only**. **Do NOT fabricate details.**
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