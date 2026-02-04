import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 檢查用戶認證
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { originalContent, refinementPrompt, keyword } = await request.json();

    if (!originalContent || !refinementPrompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 檢查使用次數
    const usageResponse = await fetch(`${request.nextUrl.origin}/api/user-usage`, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    if (!usageResponse.ok) {
      const usageError = await usageResponse.json();
      return NextResponse.json(usageError, { status: usageResponse.status });
    }

    // 執行內容微調
    const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'];
    let refinedContent = '';
    let usedModel = '';

    const fullPrompt = `
      你是一個專業的內容優化專家。請根據以下用戶的修改要求，對原始內容進行調整。

      **原始內容：**
      ${originalContent}

      **用戶修改要求：**
      ${refinementPrompt}

      **輸出要求：**
      1. 保持繁體中文（台灣）
      2. 維持 Markdown 格式
      3. 確保內容準確性
      4. 符合 ChatGPT 偏好的格式（使用粗體關鍵字、項目符號、表格等）
      
      請輸出修改後的完整內容：
    `;

    for (const modelId of modelsToTry) {
      try {
        console.log(`🤖 Content refinement using: ${modelId}...`);
        const { text } = await generateText({
          model: google(modelId),
          prompt: fullPrompt,
        });
        refinedContent = text;
        usedModel = modelId;
        break;
      } catch (e: any) {
        console.warn(`⚠️ ${modelId} failed: ${e.message}`);
        if (modelId === modelsToTry[modelsToTry.length - 1]) throw e;
      }
    }

    // 保存微調記錄到資料庫
    const { error: saveError } = await supabase
      .from('content_refinements')
      .insert({
        user_id: user.id,
        keyword: keyword || 'Unknown',
        original_content: originalContent,
        refinement_prompt: refinementPrompt,
        refined_content: refinedContent,
        model_used: usedModel
      });

    if (saveError) {
      console.error('Failed to save refinement:', saveError);
    }

    return NextResponse.json({
      refinedContent,
      usedModel,
      success: true
    });

  } catch (error: any) {
    console.error('Content refinement error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}