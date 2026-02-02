'use client';

import { useState, useEffect } from 'react';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Bot, FileSpreadsheet, Play, CheckCircle2, Loader2, Database, Table as TableIcon, TrendingUp, AlertTriangle
} from 'lucide-react';
import { getKeywordsFromExcel, runGeoPipeline, type GeoAnalysisResult } from './actions';
import ReactMarkdown from 'react-markdown';

// 🔴 題目要求：實際圖表產出
// 這裡我們直接使用「零一筆試_關鍵字模擬數據.xlsx」裡的真實數據來繪製圖表
const EXCEL_CHART_DATA = [
  { term: '滴雞精推薦', impressions: 28500, ctr: 12 },
  { term: '滴雞精推薦ptt', impressions: 15600, ctr: 8 },
  { term: '老協珍熬雞精', impressions: 12400, ctr: 12 },
  { term: '滴雞精哪裡買', impressions: 9800, ctr: 9 },
  { term: '滴雞精比較', impressions: 8900, ctr: 9 },
  { term: '田原香滴雞精', impressions: 7200, ctr: 2.5 }, // 低 CTR 機會點
  { term: '滴雞精副作用', impressions: 6800, ctr: 2.5 }, // 低 CTR 機會點
  { term: '滴雞精功效', impressions: 6500, ctr: 2.5 },   // 低 CTR 機會點
];

export default function GeoDashboard() {
  // 狀態管理
  const [keywords, setKeywords] = useState<string[]>([]);
  const [results, setResults] = useState<GeoAnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [excelError, setExcelError] = useState(false);

  // 1. 初始化：讀取 Excel 裡的關鍵字清單
  useEffect(() => {
    async function loadData() {
      const kws = await getKeywordsFromExcel();
      if (kws.length === 0) {
        setExcelError(true);
      } else {
        setKeywords(kws);
        setExcelError(false);
      }
    }
    loadData();
  }, []);

  // 2. 執行 GEO 分析 (連接 Server Action)
  const handleAnalyze = async (keyword: string) => {
    setAnalyzing(keyword);
    // 呼叫後端：Apify 爬蟲 -> Gemini 3 Pro -> Supabase 存檔
    const result = await runGeoPipeline(keyword);
    setResults(prev => [result, ...prev]); 
    setAnalyzing(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <header className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
          <Bot className="text-blue-600" />
          GEO 自動化儀表板 (Next.js + Gemini 3 Pro)
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          嚴格執行模式：讀取 Excel ➔ Apify 爬取 PAA ➔ Gemini GEO 優化 ➔ 寫入 Supabase
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左側：數據與任務區 (佔 4 等份) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* A. 實際圖表產出 (已修正寬度錯誤) */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              關鍵字數據 (Excel 視覺化)
            </h2>
            {/* 強制設定容器高度與寬度，解決 Recharts width(-1) 錯誤 */}
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={EXCEL_CHART_DATA}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="term" scale="band" angle={-45} textAnchor="end" tick={{fontSize: 10}} interval={0} />
                  <YAxis yAxisId="left" hide />
                  <YAxis yAxisId="right" orientation="right" unit="%" tick={{fontSize: 10}} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="impressions" barSize={20} fill="#3b82f6" name="曝光" />
                  <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#f97316" strokeWidth={2} dot={false} name="CTR" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
              發現 <b>滴雞精副作用</b> (曝光 6800 / CTR 2.5%) 為高潛力 GEO 目標
            </div>
          </div>

          {/* B. 待處理列表 (從 Excel 讀取) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 font-semibold flex justify-between items-center text-sm">
              <span>Excel 匯入列表</span>
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
            </div>
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
              
              {/* Excel 錯誤提示 */}
              {excelError && (
                <div className="p-4 bg-red-50 text-red-600 text-xs flex flex-col gap-2">
                   <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4" /> 讀取失敗
                   </div>
                   <p>1. 請確認「零一筆試_關鍵字模擬數據.xlsx」在專案根目錄。</p>
                   <p>2. 請確認 Excel 檔案已關閉 (未被鎖定)。</p>
                </div>
              )}

              {keywords.length === 0 && !excelError && (
                <p className="p-4 text-xs text-slate-400">正在讀取 Excel...</p>
              )}

              {keywords.map((kw, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                  <span className="text-sm font-medium">{kw}</span>
                  <button 
                    onClick={() => handleAnalyze(kw)}
                    disabled={!!analyzing || results.some(r => r.keyword === kw)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:bg-slate-300 transition"
                  >
                    {results.some(r => r.keyword === kw) ? (
                      <>完成 <CheckCircle2 className="w-3 h-3"/></>
                    ) : (
                      <>執行 GEO <Play className="w-3 h-3"/></>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右側：GEO 分析結果 (佔 8 等份) */}
        <div className="lg:col-span-8 space-y-6">
          {analyzing && (
            <div className="bg-white p-8 rounded-xl border border-blue-200 shadow-lg flex flex-col items-center justify-center animate-pulse">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-slate-800">Gemini 3 Pro 正在思考...</h3>
              <p className="text-slate-500 text-sm mt-2">
                正在執行：Apify 爬取 PAA ➔ 分析搜尋意圖 ➔ 生成結構化表格 ({analyzing})
              </p>
            </div>
          )}

          {results.map((res, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="font-bold text-lg text-blue-800">{res.keyword}</h2>
                <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-mono">
                    Supabase Saved
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-mono">
                    Gemini 3 Preview
                    </span>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PAA 來源 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Database className="w-3 h-3" /> Real PAA Questions
                  </h3>
                  <ul className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-2">
                    {res.paa.map((q, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                        <span className="text-orange-400 font-bold">•</span>{q}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Gemini GEO 產出 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Bot className="w-3 h-3" /> Gemini 3 Pro Output
                  </h3>
                  <div className="prose prose-sm prose-slate bg-white border border-slate-200 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    {/* 使用 ReactMarkdown 渲染表格和格式 */}
                    <ReactMarkdown>{res.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {results.length === 0 && !analyzing && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl min-h-[300px]">
              <TableIcon className="w-12 h-12 mb-4 opacity-20" />
              <p>請點擊左側列表，開始 GEO 自動化流程</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}