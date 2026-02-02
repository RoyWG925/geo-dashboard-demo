// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { runGeoPipeline, getKeywordsFromExcel, GeoAnalysisResult } from './actions';

// 定義一個狀態介面，用來儲存每個關鍵字的分析結果
type ResultMap = Record<string, GeoAnalysisResult>;

export default function GeoDashboard() {
  // 1. 關鍵字清單 (從 Excel 讀來)
  const [keywords, setKeywords] = useState<string[]>([]);
  
  // 2. 當前選中的關鍵字
  const [selectedKw, setSelectedKw] = useState<string | null>(null);
  
  // 3. 所有分析結果的緩存 (Key 是關鍵字, Value 是結果)
  const [results, setResults] = useState<ResultMap>({});
  
  // 4. 系統狀態
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // 手機版用

  // 初始化：畫面一載入，就去 Server 讀 Excel
  useEffect(() => {
    async function init() {
      addLog("📂 正在讀取 Excel 檔案...");
      try {
        const kws = await getKeywordsFromExcel();
        if (kws && kws.length > 0 && !kws[0].startsWith("Error")) {
          setKeywords(kws);
          setSelectedKw(kws[0]); // 預設選中第一個
          addLog(`✅ 成功載入 ${kws.length} 個關鍵字`);
        } else {
          addLog("❌ Excel 讀取失敗或為空");
          // Fallback: 如果真的讀不到，給一個預設值測試用
          setKeywords(["滴雞精推薦 (Fallback)"]); 
          setSelectedKw("滴雞精推薦 (Fallback)");
        }
      } catch (e) {
        addLog("❌ 連線錯誤");
      }
    }
    init();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // 執行單一關鍵字分析
  const handleAnalyze = async () => {
    if (!selectedKw || loading) return;
    
    setLoading(true);
    addLog(`🚀 開始分析: ${selectedKw}`);
    
    try {
      // 呼叫 Server Action
      const result = await runGeoPipeline(selectedKw);
      
      // 更新結果緩存 (這樣切換回來時資料還在)
      setResults(prev => ({
        ...prev,
        [selectedKw]: result
      }));

      if (result.status === 'success') {
        addLog(`✅ 分析完成: ${selectedKw} (Model: ${result.usedModel})`);
      } else {
        addLog(`❌ 分析失敗: ${result.errorMessage}`);
      }

    } catch (e: any) {
      addLog(`❌ 系統錯誤: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 取得當前選中關鍵字的結果 (如果有跑過的話)
  const currentResult = selectedKw ? results[selectedKw] : null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* --- 左側 Sidebar (關鍵字清單) --- */}
      <div className={`
        ${isSidebarOpen ? 'w-64' : 'w-0'} 
        bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col border-r border-slate-800
      `}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="font-bold text-white tracking-wider">DATA SOURCE</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {keywords.length === 0 && <div className="text-sm text-slate-500 p-4 text-center">讀取中...</div>}
          
          {keywords.map((kw) => (
            <button
              key={kw}
              onClick={() => setSelectedKw(kw)}
              className={`
                w-full text-left px-4 py-3 rounded-lg text-sm transition-all
                ${selectedKw === kw 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 font-medium' 
                  : 'hover:bg-slate-800 text-slate-400'}
              `}
            >
              {kw}
              {/* 如果這個關鍵字已經跑過，顯示一個綠色小點 */}
              {results[kw]?.status === 'success' && (
                <span className="float-right w-2 h-2 mt-1.5 rounded-full bg-green-400"></span>
              )}
            </button>
          ))}
        </div>

        {/* 底部 Log 預覽 */}
        <div className="p-4 bg-slate-950 text-xs font-mono border-t border-slate-800 h-48 overflow-y-auto">
           <div className="text-slate-500 mb-2 font-bold">TERMINAL LOGS</div>
           {logs.map((log, i) => (
             <div key={i} className="mb-1 truncate text-slate-400 border-l-2 border-slate-700 pl-2">
               {log}
             </div>
           ))}
        </div>
      </div>

      {/* --- 右側 Main Content (工作區) --- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded text-slate-500">
              ☰
            </button>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
              GEO Analytics Dashboard
            </h1>
          </div>
          <div className="text-sm text-slate-500">
             Current Model: <span className="font-mono bg-slate-100 px-2 py-1 rounded">Gemini 3 Flash</span>
          </div>
        </header>

        {/* 主要內容捲動區 */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50">
          
          {!selectedKw ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <span className="text-6xl mb-4">👈</span>
              <p>請從左側選單選擇一個關鍵字開始分析</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* 1. 控制台與標題 */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div>
                   <h2 className="text-3xl font-bold text-slate-800">{selectedKw}</h2>
                   <p className="text-slate-500 text-sm mt-1">
                     狀態: {currentResult ? (currentResult.status === 'success' ? '✅ 分析完成' : '❌ 發生錯誤') : '⚪ 等待執行'}
                   </p>
                </div>
                
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className={`
                    px-6 py-3 rounded-lg font-bold shadow-md transition-all flex items-center gap-2
                    ${loading 
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'}
                  `}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      執行 Pipeline 中...
                    </>
                  ) : (
                    <>🚀 執行 GEO 分析</>
                  )}
                </button>
              </div>

              {/* 2. 分析結果顯示區 */}
              {currentResult && currentResult.status === 'success' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                  
                  {/* 左欄: 真實數據 (Apify) */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">
                         真實 PAA 數據 (Google)
                       </h3>
                       <div className="flex flex-wrap gap-2">
                         {currentResult.paa.length > 0 ? currentResult.paa.map((q, i) => (
                           <div key={i} className="text-sm bg-slate-50 text-slate-700 p-3 rounded-lg border border-slate-100 w-full hover:border-blue-200 transition-colors">
                             ❓ {q}
                           </div>
                         )) : (
                            <div className="text-slate-400 italic text-sm">此關鍵字無 PAA 數據</div>
                         )}
                       </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">
                         Meta Info
                       </h3>
                       <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Model:</span>
                            <span className="font-mono text-indigo-600 bg-indigo-50 px-2 rounded">{currentResult.usedModel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Storage:</span>
                            <span className="text-green-600">Supabase ✅</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* 右欄: GEO 內容 (Gemini) */}
                  <div className="lg:col-span-2">
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
                      <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        GEO Optimized Content
                      </h3>
                      
                      {/* 內容渲染區 */}
                      <article className="prose prose-slate max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600">
                        {/* 簡單的 Markdown 渲染，保留換行與空白 */}
                        <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">
                          {currentResult.content}
                        </div>
                      </article>
                    </div>
                  </div>

                </div>
              )}
              
              {/* 錯誤顯示 */}
              {currentResult && currentResult.status === 'error' && (
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
                  <h3 className="text-red-800 font-bold">Pipeline Error</h3>
                  <p className="text-red-600 mt-2">{currentResult.errorMessage}</p>
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}