'use client';

import { useState, useEffect, useMemo } from 'react';
import { runGeoPipeline, getKeywordsFromExcel, GeoAnalysisResult } from './actions';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

type ResultMap = Record<string, GeoAnalysisResult & { duration?: number }>;

interface UserUsage {
  usage_count: number;
  max_usage: number;
  is_premium: boolean;
}

export default function GeoDashboard() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [selectedKw, setSelectedKw] = useState<string | null>(null);
  const [results, setResults] = useState<ResultMap>({});
  const [user, setUser] = useState<any>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [showRefinement, setShowRefinement] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // 檢查用戶認證狀態
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setUser(session.user);
      
      // 獲取用戶使用次數
      try {
        const response = await fetch('/api/user-usage');
        if (response.ok) {
          const usage = await response.json();
          setUserUsage(usage);
          addLog(`👤 用戶登入: ${session.user.email} (${usage.usage_count}/${usage.max_usage})`);
        }
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      }
    };
    checkAuth();
  }, [router, supabase.auth]);

  // 監聽認證狀態變化
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase.auth]);

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
    
    // 檢查是否為 Premium 用戶，普通用戶不能新增關鍵字
    if (userUsage && !userUsage.is_premium) {
      addLog(`❌ 無法新增關鍵字: 普通用戶無此權限`);
      alert('普通用戶無法新增關鍵字。如需此功能請聯繫管理員\n電子郵件：jg971402@gmail.com');
      return;
    }
    
    // 檢查是否超過使用限制
    if (userUsage && userUsage.usage_count >= userUsage.max_usage && !userUsage.is_premium) {
      addLog(`❌ 無法新增關鍵字: 已達使用次數上限 (${userUsage.usage_count}/${userUsage.max_usage})`);
      alert('您已達到使用次數上限，無法新增關鍵字。請聯繫管理員以獲得更多使用次數。');
      return;
    }
    
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
    
    // 檢查使用次數
    if (userUsage && userUsage.usage_count >= userUsage.max_usage && !userUsage.is_premium) {
      addLog(`❌ 無法執行分析: 已達使用次數上限 (${userUsage.usage_count}/${userUsage.max_usage})`);
      alert('您已達到使用次數上限，無法執行分析。請聯繫管理員\n電子郵件：jg971402@gmail.com');
      return;
    }
    
    setLoading(true);
    addLog(`🚀 [Start] 開始分析: ${selectedKw}`);
    
    const startTime = performance.now();
    
    try {
      const result = await runGeoPipeline(selectedKw);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      setResults(prev => ({ 
        ...prev, 
        [selectedKw]: { ...result, duration } 
      }));

      if (result.status === 'success') {
        addLog(`✅ [Success] ${selectedKw} 完成 (耗時: ${duration}ms)`);
        // 更新使用次數
        if (userUsage) {
          setUserUsage(prev => prev ? { ...prev, usage_count: prev.usage_count + 1 } : null);
        }
      } else {
        addLog(`❌ [Failed] ${selectedKw} 失敗: ${result.errorMessage}`);
      }

    } catch (e: any) {
      addLog(`❌ 系統錯誤: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefineContent = async () => {
    if (!selectedKw || !refinementPrompt.trim() || !currentResult?.content) return;
    
    setIsRefining(true);
    addLog(`🔧 開始微調內容: ${selectedKw}`);
    
    try {
      const response = await fetch('/api/refine-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalContent: currentResult.content,
          refinementPrompt: refinementPrompt.trim(),
          keyword: selectedKw
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '微調失敗');
      }

      const { refinedContent, usedModel } = await response.json();
      
      // 更新結果
      setResults(prev => ({
        ...prev,
        [selectedKw]: {
          ...prev[selectedKw],
          content: refinedContent,
          usedModel: usedModel
        }
      }));

      addLog(`✅ 內容微調完成: ${selectedKw}`);
      setShowRefinement(false);
      setRefinementPrompt("");
      
      // 更新使用次數
      if (userUsage) {
        setUserUsage(prev => prev ? { ...prev, usage_count: prev.usage_count + 1 } : null);
      }

    } catch (error: any) {
      addLog(`❌ 微調失敗: ${error.message}`);
      alert(error.message);
    } finally {
      setIsRefining(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
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

  // 如果用戶未登入，不渲染主界面
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">正在檢查登入狀態...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full opacity-0'} bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col border-r border-slate-800 z-20`}>
        <div className="p-5 border-b border-slate-800 bg-slate-950 shrink-0 space-y-4">
          <h2 className="font-bold text-white tracking-wider text-sm">DATASETS ({keywords.length})</h2>
          
          {/* 用戶權限提示 */}
          {userUsage && !userUsage.is_premium && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 text-xs">
              <div className="flex items-center gap-2 text-amber-300 mb-1">
                <span>⚠️</span>
                <span className="font-medium">普通用戶限制</span>
              </div>
              <p className="text-amber-200/80">
                無法新增關鍵字，如需此功能請聯繫管理員<br />
                電子郵件：jg971402@gmail.com
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={userUsage?.is_premium ? "輸入關鍵字..." : "僅 Premium 用戶可新增"} 
              value={newKeywordInput} 
              onChange={(e) => setNewKeywordInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()} 
              disabled={userUsage ? !userUsage.is_premium : false}
              className={`w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-2 outline-none focus:border-blue-500 ${
                userUsage && !userUsage.is_premium ? 'opacity-50 cursor-not-allowed' : ''
              }`} 
            />
            <button 
              onClick={handleAddKeyword} 
              disabled={userUsage ? !userUsage.is_premium : false}
              className={`bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 rounded font-bold transition-colors ${
                userUsage && !userUsage.is_premium ? 'opacity-50 cursor-not-allowed bg-slate-500' : ''
              }`}
            >
              Add
            </button>
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
          <div className="flex items-center gap-4">
            {/* 使用次數顯示 */}
            {userUsage && (
              <div className="text-xs text-right hidden sm:block">
                <p className="text-slate-900 font-bold">
                  {userUsage.usage_count}/{userUsage.max_usage} 
                  {userUsage.is_premium && <span className="text-yellow-600 ml-1">👑</span>}
                </p>
                <p className="text-slate-400">使用次數</p>
              </div>
            )}
            
            {/* 用戶信息 */}
            <div className="text-xs text-right hidden md:block">
              <p className="text-slate-900 font-bold">{user?.email}</p>
              <button 
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                登出
              </button>
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
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]} 
                    fill="#4f46e5"
                  />
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
                      <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h3 className="font-bold text-slate-800">Optimized Content</h3>
                        <button
                          onClick={() => setShowRefinement(!showRefinement)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition-colors"
                        >
                          🔧 微調內容
                        </button>
                      </div>

                      {/* 微調功能區域 */}
                      {showRefinement && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <h4 className="font-medium text-slate-700 mb-3">內容微調</h4>
                          <div className="space-y-3">
                            <textarea
                              value={refinementPrompt}
                              onChange={(e) => setRefinementPrompt(e.target.value)}
                              placeholder="請描述您希望如何修改內容，例如：&#10;- 移除表格&#10;- 增加更多說明&#10;- 調整語氣"
                              className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleRefineContent}
                                disabled={isRefining || !refinementPrompt.trim()}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm rounded-lg font-medium transition-colors"
                              >
                                {isRefining ? '微調中...' : '執行微調'}
                              </button>
                              <button
                                onClick={() => {
                                  setShowRefinement(false);
                                  setRefinementPrompt("");
                                }}
                                className="px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white text-sm rounded-lg font-medium transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

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