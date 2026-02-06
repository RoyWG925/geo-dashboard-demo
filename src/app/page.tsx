'use client';

import { useState, useEffect, useMemo } from 'react';
import { getKeywordsFromExcel, getUserKeywords, addUserKeyword, deleteUserKeyword, getAnalysisHistory, GeoAnalysisResult } from './actions';
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
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [showRefinement, setShowRefinement] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userCustomKeywords, setUserCustomKeywords] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    id: string;
    keyword: string;
    paa_questions: string[];
    geo_optimized_content: string;
    created_at: string;
  }>>([]);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  const modelOptions = [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
  ];

  const defaultPrompt = `你是一個專業的 GEO (Generative Engine Optimization) 專家。

**任務目標：**
撰寫符合 AI 搜尋引擎（如 ChatGPT Search、Google AI Overviews、Perplexity）偏好的內容。

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
- **表格：** 包含至少一個 Markdown 比較表格（最少 3 欄）`;

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
      addLog("📂 系統啟動: 正在讀取關鍵字清單...");
      try {
        // 1. 讀取 Excel 關鍵字
        const excelKws = await getKeywordsFromExcel();
        
        // 2. 讀取用戶自定義關鍵字
        const userKws = await getUserKeywords();
        
        // 3. 記錄用戶自定義的關鍵字
        setUserCustomKeywords(new Set(userKws));
        
        // 4. 合併關鍵字（用戶自定義的放在前面）
        let allKeywords: string[] = [];
        
        if (userKws.length > 0) {
          allKeywords = [...userKws];
          addLog(`✅ 載入 ${userKws.length} 個自定義關鍵字`);
        }
        
        if (excelKws && excelKws.length > 0 && !excelKws[0].startsWith("Error")) {
          allKeywords = [...allKeywords, ...excelKws];
          addLog(`✅ 載入 ${excelKws.length} 個 Excel 關鍵字`);
        } else {
          // 備用清單
          const fallbackKws = ["滴雞精推薦", "葉黃素功效", "益生菌怎麼吃", "魚油推薦", "維他命C"];
          allKeywords = [...allKeywords, ...fallbackKws];
          addLog("⚠️ Excel 讀取異常，使用備用清單");
        }
        
        setKeywords(allKeywords);
        addLog(`📊 總計: ${allKeywords.length} 個關鍵字`);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : '未知錯誤';
        addLog(`❌ 載入錯誤: ${errorMsg}`);
        setKeywords(["滴雞精推薦", "葉黃素功效", "益生菌怎麼吃", "魚油推薦", "維他命C"]);
      }
    }
    init();
  }, []);

  const handleAddKeyword = async () => {
    if (!newKeywordInput.trim()) return;
    
    const newKw = newKeywordInput.trim();
    
    // 檢查是否已存在
    if (keywords.includes(newKw)) {
      addLog(`⚠️ 關鍵字已存在: "${newKw}"`);
      alert('此關鍵字已存在');
      return;
    }
    
    // 🔥 保存到資料庫
    addLog(`💾 正在保存關鍵字: "${newKw}"`);
    const result = await addUserKeyword(newKw);
    
    if (result.success) {
      // 成功：更新前端列表和追蹤
      setKeywords(prev => [newKw, ...prev]);
      setUserCustomKeywords(prev => new Set([...prev, newKw]));
      setSelectedKw(newKw);
      setNewKeywordInput("");
      addLog(`✅ ${result.message}: "${newKw}"`);
    } else {
      // 失敗：顯示錯誤訊息
      addLog(`❌ ${result.message}`);
      alert(result.message);
    }
  };

  const handleDeleteKeyword = async (keyword: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 防止觸發選擇關鍵字
    
    if (!confirm(`確定要刪除關鍵字「${keyword}」嗎？`)) {
      return;
    }
    
    addLog(`🗑️ 正在刪除關鍵字: "${keyword}"`);
    const result = await deleteUserKeyword(keyword);
    
    if (result.success) {
      // 成功：更新前端列表和追蹤
      setKeywords(prev => prev.filter(k => k !== keyword));
      setUserCustomKeywords(prev => {
        const newSet = new Set(prev);
        newSet.delete(keyword);
        return newSet;
      });
      if (selectedKw === keyword) {
        setSelectedKw(null);
      }
      addLog(`✅ ${result.message}: "${keyword}"`);
    } else {
      // 失敗：顯示錯誤訊息
      addLog(`❌ ${result.message}`);
      alert(result.message);
    }
  };

  const loadAnalysisHistory = async () => {
    addLog(`📜 載入分析歷史紀錄...`);
    const history = await getAnalysisHistory(20);
    setAnalysisHistory(history);
    addLog(`✅ 載入 ${history.length} 筆歷史紀錄`);
  };

  const loadHistoryResult = (historyItem: typeof analysisHistory[0]) => {
    addLog(`📂 載入歷史紀錄: "${historyItem.keyword}"`);
    
    // 設置選中的關鍵字
    setSelectedKw(historyItem.keyword);
    
    // 如果關鍵字不在列表中，添加到列表
    if (!keywords.includes(historyItem.keyword)) {
      setKeywords(prev => [historyItem.keyword, ...prev]);
    }
    
    // 設置結果
    setResults(prev => ({
      ...prev,
      [historyItem.keyword]: {
        keyword: historyItem.keyword,
        paa: historyItem.paa_questions || [],
        content: historyItem.geo_optimized_content || '',
        status: 'success',
        usedModel: 'cached'
      }
    }));
    
    // 關閉歷史紀錄面板
    setShowHistory(false);
  };

  const handleAnalyze = async () => {
    if (!selectedKw || isStreaming) return;
    
    // 檢查使用次數
    if (userUsage && userUsage.usage_count >= userUsage.max_usage && !userUsage.is_premium) {
      addLog(`❌ 無法執行分析: 已達使用次數上限 (${userUsage.usage_count}/${userUsage.max_usage})`);
      alert('您已達到使用次數上限，無法執行分析。請聯繫管理員\n電子郵件：jg971402@gmail.com');
      return;
    }
    
    setIsStreaming(true);
    setStreamingContent("");
    addLog(`🚀 [Start] 開始串流分析: ${selectedKw} (模型: ${selectedModel})`);
    if (forceRefresh) {
      addLog(`🔄 強制重新生成 (不使用快取)`);
    }
    if (customPrompt) {
      addLog(`🎨 使用自定義 Prompt`);
    }
    
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/stream-geo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: selectedKw,
          selectedModel,
          customPrompt: customPrompt || undefined,
          forceRefresh
        }),
      });

      if (!response.ok) {
        throw new Error('Stream request failed');
      }

      // 檢查是否為快取響應
      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.type === 'cached') {
          addLog(`✅ 使用快取資料 (節省成本)`);
          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);
          
          setResults(prev => ({
            ...prev,
            [selectedKw]: {
              keyword: selectedKw,
              paa: data.paa || [],
              content: data.content,
              status: 'success',
              usedModel: 'cached',
              duration
            }
          }));
          setIsStreaming(false);
          return;
        }
      }

      // 處理串流響應
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let paaQuestions: string[] = [];

      // 🔥 從 header 獲取 Base64 編碼的 PAA 問題
      const paaHeaderBase64 = response.headers.get('X-PAA-Questions-Base64');
      if (paaHeaderBase64) {
        try {
          // ✅ 正確的 UTF-8 Base64 解碼方法
          const paaJson = decodeURIComponent(
            atob(paaHeaderBase64)
              .split('')
              .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          paaQuestions = JSON.parse(paaJson);
          addLog(`📝 獲取 ${paaQuestions.length} 個 PAA 問題`);
        } catch (e) {
          console.error('Failed to decode PAA questions:', e);
          addLog(`⚠️ PAA 問題解碼失敗`);
        }
      }

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
        }
      }

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      setResults(prev => ({
        ...prev,
        [selectedKw]: {
          keyword: selectedKw,
          paa: paaQuestions,
          content: accumulatedContent,
          status: 'success',
          usedModel: selectedModel,
          duration
        }
      }));

      addLog(`✅ [Success] ${selectedKw} 完成 (耗時: ${duration}ms)`);
      
      // 更新使用次數
      if (userUsage) {
        setUserUsage(prev => prev ? { ...prev, usage_count: prev.usage_count + 1 } : null);
      }

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '未知錯誤';
      addLog(`❌ 系統錯誤: ${errorMsg}`);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '微調失敗';
      addLog(`❌ 微調失敗: ${errorMessage}`);
      alert(errorMessage);
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
          
          {/* 自定義關鍵字說明 */}
          {userUsage?.is_premium && (
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 text-xs">
              <div className="flex items-center gap-2 text-blue-300 mb-1">
                <span>★</span>
                <span className="font-medium">自定義關鍵字</span>
              </div>
              <p className="text-blue-200/80">
                帶有 ★ 標記的是您的自定義關鍵字<br />
                滑鼠移到關鍵字上可刪除
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
              const isCustom = userCustomKeywords.has(kw);
              return (
                <div key={kw} className="relative group">
                  <button 
                    onClick={() => setSelectedKw(kw)} 
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex justify-between items-center ${selectedKw === kw ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                  >
                    <span className="truncate pr-4">
                      {isCustom && <span className="text-yellow-400 mr-1">★</span>}
                      {kw}
                    </span>
                    <div className="flex items-center gap-2">
                      {res?.status === 'success' && <span className="w-2 h-2 rounded-full bg-green-400"></span>}
                      {res?.status === 'error' && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                      {isStreaming && selectedKw === kw && !res && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>}
                    </div>
                  </button>
                  {isCustom && (
                    <button
                      onClick={(e) => handleDeleteKeyword(kw, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
                      title="刪除此關鍵字"
                    >
                      🗑️
                    </button>
                  )}
                </div>
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
            {/* 歷史紀錄按鈕 */}
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) {
                  loadAnalysisHistory();
                }
              }}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              📜 歷史紀錄
            </button>
            
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
            
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${isStreaming ? 'bg-yellow-500 animate-pulse' : 'bg-gradient-to-tr from-blue-500 to-purple-600'}`}>AI</div>
          </div>
        </header>

        {/* 🔥 歷史紀錄側邊欄 */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">📜 分析歷史紀錄</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6">
                {analysisHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-lg mb-2">尚無分析紀錄</p>
                    <p className="text-sm">執行 GEO 分析後，結果會顯示在這裡</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysisHistory.map((item) => (
                      <div
                        key={item.id}
                        className="border border-slate-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => loadHistoryResult(item)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-slate-800 text-lg">{item.keyword}</h3>
                          <span className="text-xs text-slate-400">
                            {new Date(item.created_at).toLocaleDateString('zh-TW', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        {item.paa_questions && item.paa_questions.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-slate-500 mb-1">
                              📝 {item.paa_questions.length} 個 PAA 問題
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {item.paa_questions[0]}
                            </p>
                          </div>
                        )}
                        
                        <div className="text-xs text-slate-500 line-clamp-3">
                          {item.geo_optimized_content?.substring(0, 150)}...
                        </div>
                        
                        <div className="mt-3 flex justify-end">
                          <span className="text-xs text-blue-600 font-medium">
                            點擊載入 →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
              
              {/* 🔥 新增：進階設定區塊 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-800">⚙️ 進階設定</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">選填</span>
                  </div>
                  <span className="text-slate-400">{showAdvancedSettings ? '▼' : '▶'}</span>
                </button>

                {showAdvancedSettings && (
                  <div className="mt-6 space-y-6">
                    {/* 自定義 Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        自定義 Prompt（選填）
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        💡 留空則使用系統預設的最佳實踐 Prompt。您可以在此調整語氣、風格或增加特殊要求。
                      </p>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder={defaultPrompt}
                        className="w-full h-48 px-4 py-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-slate-400">
                          {customPrompt ? `已自定義 (${customPrompt.length} 字)` : '使用預設 Prompt'}
                        </span>
                        {customPrompt && (
                          <button
                            onClick={() => setCustomPrompt("")}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            重置為預設
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 強制重新生成 */}
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="forceRefresh"
                        checked={forceRefresh}
                        onChange={(e) => setForceRefresh(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="forceRefresh" className="text-sm text-slate-700 cursor-pointer">
                        <span className="font-medium">強制重新生成</span>
                        <span className="text-slate-500 ml-2">（不使用快取，會消耗 API 額度）</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                   <h2 className="text-4xl font-extrabold text-slate-800">{selectedKw}</h2>
                   <div className="flex items-center gap-2 mt-2">
                     <span className={`w-2.5 h-2.5 rounded-full ${currentResult?.status === 'success' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                     <span className="text-sm text-slate-500">{currentResult?.status === 'success' ? `Analysis Complete (${currentResult.duration}ms)` : 'Ready'}</span>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-600">選擇 AI 模型</label>
                    <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={isStreaming}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {modelOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={handleAnalyze} 
                    disabled={isStreaming} 
                    className={`px-8 py-3 rounded-xl font-bold text-sm shadow-lg text-white mt-6 ${isStreaming ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {isStreaming ? "⚡ 生成中..." : "🚀 執行 GEO 分析"}
                  </button>
                </div>
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
                        {isStreaming && streamingContent ? (
                          <div className="relative">
                            <div className="absolute top-0 right-0 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                              <span className="animate-pulse">⚡</span>
                              <span>即時生成中...</span>
                            </div>
                            <div className="whitespace-pre-wrap font-sans text-base leading-relaxed pt-8">
                              {streamingContent}
                              <span className="inline-block w-2 h-5 bg-blue-600 animate-pulse ml-1"></span>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">
                            {currentResult.content}
                          </div>
                        )}
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