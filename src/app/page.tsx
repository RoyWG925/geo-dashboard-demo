// src/app/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { runGeoPipeline, getKeywordsFromExcel, GeoAnalysisResult } from './actions';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

type ResultMap = Record<string, GeoAnalysisResult & { duration?: number }>;

export default function GeoDashboard() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [selectedKw, setSelectedKw] = useState<string | null>(null);
  const [results, setResults] = useState<ResultMap>({});
  
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  useEffect(() => {
    async function init() {
      addLog("📂 系統啟動: 正在讀取 Excel 完整清單...");
      try {
        const kws = await getKeywordsFromExcel();
        if (kws && kws.length > 0 && !kws[0].startsWith("Error")) {
          setKeywords(kws);
          addLog(`✅ 讀取成功: 共載入 ${kws.length} 個關鍵字`);
        } else {
          addLog("❌ Excel 讀取異常，切換至備用清單");
          setKeywords(["滴雞精推薦", "葉黃素功效", "益生菌怎麼吃", "魚油推薦", "維他命C"]); 
        }
      } catch (e: any) {
        addLog(`❌ 連線錯誤: ${e.message}`);
      }
    }
    init();
  }, []);

  const handleAddKeyword = () => {
    if (!newKeywordInput.trim()) return;
    const newKw = newKeywordInput.trim();
    if (!keywords.includes(newKw)) {
      setKeywords(prev => [newKw, ...prev]);
      addLog(`➕ 已手動新增關鍵字: "${newKw}"`);
    }
    setSelectedKw(newKw);
    setNewKeywordInput("");
  };

  const handleAnalyze = async () => {
    if (!selectedKw || loading) return;
    
    setLoading(true);
    addLog(`🚀 [Start] 開始分析: ${selectedKw}`);
    
    // ⏱️ 開始計時
    const startTime = performance.now();
    
    try {
      const result = await runGeoPipeline(selectedKw);
      
      // ⏱️ 結束計時
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime); // 毫秒

      setResults(prev => ({ 
        ...prev, 
        [selectedKw]: { ...result, duration } 
      }));

      if (result.status === 'success') {
        addLog(`✅ [Success] ${selectedKw} 完成 (耗時: ${duration}ms)`);
      } else {
        addLog(`❌ [Failed] ${selectedKw} 失敗: ${result.errorMessage}`);
      }

    } catch (e: any) {
      addLog(`❌ 系統錯誤: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredKeywords = useMemo(() => {
    return keywords.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [keywords, searchQuery]);

  const currentResult = selectedKw ? results[selectedKw] : null;

  const chartData = keywords.map(kw => {
    const res = results[kw];
    return {
      name: kw,
      count: res?.status === 'success' ? res.paa.length : 0,
      status: res?.status || 'pending'
    };
  });

  // 🟢 GEO Compliance Check Function (前端驗證)
  //  - 這裡是用程式邏輯實現這個概念
  const checkCompliance = (content: string) => {
    return {
      hasTable: content.includes('|') && content.includes('---'),
      hasBullet: content.includes('- ') || content.includes('* '),
      hasHeading: content.includes('## '),
      hasBLUF: content.length > 0 && !content.startsWith('#') // 簡單檢查是否直接開始回答
    };
  };

  const compliance = currentResult?.content ? checkCompliance(currentResult.content) : null;

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full opacity-0'} bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col border-r border-slate-800 z-20`}>
        <div className="p-5 border-b border-slate-800 bg-slate-950 shrink-0 space-y-4">
          <h2 className="font-bold text-white tracking-wider text-sm">DATASETS ({keywords.length})</h2>
          <div className="flex gap-2">
            <input type="text" placeholder="輸入關鍵字..." value={newKeywordInput} onChange={(e) => setNewKeywordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-2 outline-none focus:border-blue-500" />
            <button onClick={handleAddKeyword} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 rounded font-bold">Add</button>
          </div>
          <div className="relative">
            <input type="text" placeholder="過濾清單..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-400 text-xs rounded px-2 py-1.5 outline-none" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1.5 text-slate-500">✕</button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          <div className="flex flex-col p-2 space-y-1">
            {filteredKeywords.map((kw) => {
              const res = results[kw];
              return (
                <button key={kw} onClick={() => setSelectedKw(kw)} className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex justify-between items-center ${selectedKw === kw ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                  <span className="truncate pr-4">{kw}</span>
                  {res?.status === 'success' && <span className="w-2 h-2 rounded-full bg-green-400"></span>}
                  {res?.status === 'error' && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                  {loading && selectedKw === kw && !res && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="h-48 bg-black border-t border-slate-800 shrink-0 flex flex-col">
           <div className="px-4 py-2 bg-slate-950 text-xs font-bold text-slate-500 flex justify-between"><span>SYSTEM LOGS</span><button onClick={()=>setLogs([])}>Clear</button></div>
           <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
             {logs.map((log, i) => <div key={i} className={`truncate ${log.includes('✅')?'text-green-500':log.includes('❌')?'text-red-500':'text-slate-400'}`}>{log}</div>)}
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded text-slate-600">☰</button>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">GEO Analytics Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-xs text-right hidden sm:block">
                <p className="text-slate-900 font-bold">{currentResult?.usedModel || 'Pending...'}</p>
                <p className="text-slate-400">Active Model</p>
             </div>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-gradient-to-tr from-blue-500 to-purple-600'}`}>AI</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-thin scrollbar-thumb-slate-300">
          
          {/* Chart Section */}
          <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Dataset Overview (PAA Count)</h3>
              <span className="text-xs text-slate-400">Y-Axis: Questions Found</span>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" hide />
                  <YAxis tick={{fontSize:12, fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.status === 'success' ? '#4f46e5' : '#e2e8f0'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {!selectedKw ? (
            <div className="text-center py-10 text-slate-400">請選擇關鍵字以開始分析</div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
              <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                   <h2 className="text-4xl font-extrabold text-slate-800">{selectedKw}</h2>
                   <div className="flex items-center gap-2 mt-2">
                     <span className={`w-2.5 h-2.5 rounded-full ${currentResult?.status === 'success' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                     <span className="text-sm text-slate-500">{currentResult?.status === 'success' ? `Analysis Complete (${currentResult.duration}ms)` : 'Ready'}</span>
                   </div>
                </div>
                <button onClick={handleAnalyze} disabled={loading} className={`px-8 py-3 rounded-xl font-bold text-sm shadow-lg text-white ${loading ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {loading ? "Processing..." : "🚀 執行 GEO 分析"}
                </button>
              </div>

              {currentResult && currentResult.status === 'success' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  
                  {/* Left Column */}
                  <div className="xl:col-span-1 space-y-6">
                    
                    {/* 🟢 GEO Compliance Score Card (新增的必殺技) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                       <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         GEO Optimization Score
                       </h3>
                       <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">Markdown Table</span>
                            {compliance?.hasTable ? <span className="text-green-600 font-bold bg-green-50 px-2 rounded">Pass ✅</span> : <span className="text-red-400">Missing ❌</span>}
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">Bullet Points</span>
                            {compliance?.hasBullet ? <span className="text-green-600 font-bold bg-green-50 px-2 rounded">Pass ✅</span> : <span className="text-red-400">Missing ❌</span>}
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">H2/H3 Structure</span>
                            {compliance?.hasHeading ? <span className="text-green-600 font-bold bg-green-50 px-2 rounded">Pass ✅</span> : <span className="text-red-400">Missing ❌</span>}
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">BLUF Format</span>
                            {compliance?.hasBLUF ? <span className="text-green-600 font-bold bg-green-50 px-2 rounded">Pass ✅</span> : <span className="text-red-400">Missing ❌</span>}
                          </div>
                       </div>
                    </div>

                    {/* Stats Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Pipeline Stats</h3>
                       <div className="space-y-3 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">AI Model</span><span className="font-mono text-indigo-600 bg-indigo-50 px-2 rounded">{currentResult.usedModel}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Apify Status</span><span className="text-green-600 font-medium">Active</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Database</span><span className="text-green-600 font-medium">Saved</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="text-slate-900 font-bold">{currentResult.duration}ms</span></div>
                       </div>
                    </div>

                    {/* PAA Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                       <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">PAA Questions</h3>
                         <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{currentResult.paa.length}</span>
                       </div>
                       <div className="flex flex-col gap-2">
                         {currentResult.paa.length > 0 ? currentResult.paa.map((q, i) => <div key={i} className="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">{q}</div>) : <div className="text-slate-400 italic text-sm text-center">無 PAA 數據</div>}
                       </div>
                    </div>
                  </div>

                  {/* Right Column: Content */}
                  <div className="xl:col-span-2">
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 min-h-[600px]">
                      <h3 className="font-bold text-slate-800 mb-6 border-b pb-4">Optimized Content</h3>
                      <article className="prose prose-slate prose-lg max-w-none">
                        <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">{currentResult.content}</div>
                      </article>
                    </div>
                  </div>
                </div>
              )}
              {currentResult?.status === 'error' && <div className="bg-red-50 border border-red-200 p-8 rounded-2xl text-center"><h3 className="text-red-900 font-bold">Failed</h3><p className="text-red-700 mt-2">{currentResult.errorMessage}</p></div>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}