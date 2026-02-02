// src/app/page.tsx
'use client';

import { useState } from 'react';
// 👇 引入真正的讀檔函式 (getKeywordsFromExcel) 和 執行函式 (runGeoPipeline)
import { runGeoPipeline, getKeywordsFromExcel, GeoAnalysisResult } from './actions';
import ReactMarkdown from 'react-markdown'; // 如果你有裝這個，沒裝的話下面用 CSS 顯示也可以

export default function GeoDashboard() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<GeoAnalysisResult[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleRun = async () => {
    if (loading) return;
    setLoading(true);
    setLogs([]);
    setResults([]);
    
    addLog("🚀 系統初始化...");
    addLog("📡 連線 Server Action: 準備讀取 Excel 檔案...");

    let keywords: string[] = [];

    try {
      // 🟢 真實動作：呼叫後端讀取 Excel
      const serverData = await getKeywordsFromExcel();
      
      // 檢查回傳結果
      if (!serverData || serverData.length === 0) {
        addLog("❌ 錯誤: Excel 檔案為空或讀取失敗");
        setLoading(false);
        return;
      }

      // 檢查是否為後端回傳的錯誤訊息 (例如檔案不存在)
      if (serverData[0].startsWith("Error:")) {
        addLog(`❌ 嚴重錯誤: 伺服器回報 ${serverData[0]}`);
        addLog("💡 提示: 請確認 data.xlsx 是否有 Git Push 到儲存庫中");
        setLoading(false);
        return;
      }

      // 成功讀取
      keywords = serverData;
      addLog(`✅ Excel 讀取成功！偵測到 ${keywords.length} 個關鍵字: [${keywords.join(', ')}]`);

    } catch (error: any) {
      addLog(`❌ 連線錯誤: ${error.message}`);
      setLoading(false);
      return;
    }

    // 🟢 真實動作：針對 Excel 裡的每一個字執行 Pipeline
    for (const kw of keywords) {
      addLog(`⚡ ------------------------------------------------`);
      addLog(`⚡ 開始執行分析: "${kw}"`);
      addLog(`🕷️ 呼叫 Apify 爬蟲 (Real-Time SERP)...`);
      
      try {
        const res = await runGeoPipeline(kw);
        
        if (res.status === 'success') {
          addLog(`✅ Apify: 抓取完成 (PAA: ${res.paa.length} 筆)`);
          addLog(`🤖 AI: 生成完成 (Model: ${res.usedModel})`);
          addLog(`💾 DB: 寫入 Supabase 成功`);
          setResults(prev => [res, ...prev]);
        } else {
          addLog(`❌ Pipeline 失敗: ${res.errorMessage}`);
          // 失敗也要顯示出來，證明不是假資料
          setResults(prev => [res, ...prev]);
        }
      } catch (e: any) {
        addLog(`❌ 未知系統錯誤: ${e.message}`);
      }
    }
    
    addLog(`🏁 所有任務執行完畢`);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600">
            GEO 自動化分析儀表板
          </h1>
          <p className="text-slate-600 font-medium">
            Next.js 14 • Real-Time Apify • Gemini AI • Supabase
          </p>

          {/* 視覺化流程圖 */}
          <div className="flex flex-wrap justify-center items-center gap-2 text-sm text-slate-600 mt-6 bg-white p-4 rounded-xl shadow-sm w-fit mx-auto border border-slate-200">
            <span className="flex items-center font-bold"><span className="bg-slate-800 text-white w-6 h-6 flex items-center justify-center rounded-full mr-2 text-xs">1</span> 讀取 Excel</span>
            <span className="text-slate-300">➜</span>
            <span className="flex items-center font-bold"><span className="bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full mr-2 text-xs">2</span> Apify 爬蟲</span>
            <span className="text-slate-300">➜</span>
            <span className="flex items-center font-bold"><span className="bg-purple-600 text-white w-6 h-6 flex items-center justify-center rounded-full mr-2 text-xs">3</span> Gemini 優化</span>
            <span className="text-slate-300">➜</span>
            <span className="flex items-center font-bold"><span className="bg-green-600 text-white w-6 h-6 flex items-center justify-center rounded-full mr-2 text-xs">4</span> 存入 DB</span>
          </div>
        </header>

        {/* 啟動按鈕 */}
        <div className="flex justify-center">
          <button
            onClick={handleRun}
            disabled={loading}
            className={`
              px-10 py-4 rounded-full text-xl font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95
              ${loading 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30 ring-4 ring-blue-50'}
            `}
          >
            {loading ? '⚡ 系統正在全速運算中...' : '🚀 執行真實數據分析'}
          </button>
        </div>

        {/* 主內容區：左日誌 / 右結果 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左側：即時運算日誌 (Terminal) */}
          <div className="lg:col-span-4">
            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800 sticky top-8">
              <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-xs text-slate-400 font-mono">Terminal Output</span>
              </div>
              <div className="p-4 h-[500px] overflow-y-auto font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                {logs.length === 0 && <p className="text-slate-600 italic text-center mt-20">系統待命，準備執行...</p>}
                {logs.map((log, i) => (
                  <div key={i} className={`border-l-2 pl-3 ${log.includes('❌') ? 'text-red-400 border-red-800' : log.includes('✅') ? 'text-green-400 border-green-800' : 'text-slate-300 border-slate-700'}`}>
                    {log}
                  </div>
                ))}
                {loading && <div className="animate-pulse text-blue-400 mt-4">▍ Processing data stream...</div>}
              </div>
            </div>
          </div>

          {/* 右側：分析結果卡片 */}
          <div className="lg:col-span-8 space-y-6">
            {results.length === 0 && !loading && (
              <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-lg">尚未有分析結果</p>
                <p className="text-slate-500 mt-2">請點擊上方按鈕讀取 Excel 並開始 Pipeline</p>
              </div>
            )}

            {results.map((res, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 transition-all hover:shadow-xl">
                
                {/* 卡片標題列 */}
                <div className={`px-6 py-4 border-b flex justify-between items-center ${res.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔍</span>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{res.keyword}</h3>
                      <p className="text-xs text-slate-500">分析時間: {new Date().toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {res.status === 'success' ? (
                       <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                         ✨ Success
                       </span>
                    ) : (
                       <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                         ❌ Failed
                       </span>
                    )}
                  </div>
                </div>

                {/* 卡片內容 */}
                <div className="p-6">
                  {res.status === 'error' ? (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                      <p className="font-bold text-red-700">執行失敗</p>
                      <p className="text-sm text-red-600 mt-1">{res.errorMessage}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* PAA 數據展示 */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            真實 PAA 數據 (From Google)
                          </h4>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Count: {res.paa.length}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {res.paa.length > 0 ? res.paa.map((q, i) => (
                            <span key={i} className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                              {q}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-400 italic">無 PAA 數據 (使用 Fallback 邏輯)</span>
                          )}
                        </div>
                      </div>

                      <hr className="border-slate-100" />

                      {/* GEO AI 內容展示 */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            GEO 優化內容 (Gemini)
                          </h4>
                          <span className="text-xs font-mono bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100">
                            Model: {res.usedModel}
                          </span>
                        </div>
                        
                        {/* 這裡用 whitespace-pre-wrap 保留 AI 的排版，如果你有裝 react-markdown 可以換成 <ReactMarkdown> */}
                        <div className="prose prose-slate max-w-none bg-slate-50 p-5 rounded-xl border border-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-700">
                          {res.content}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}