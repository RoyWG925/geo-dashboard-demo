-- ============================================
-- 用戶自定義關鍵字表
-- ============================================
-- 執行前請確認：
-- 1. 已連接到正確的 Supabase 專案
-- 2. 在 SQL Editor 中執行此腳本
-- 3. 執行後重新整理 Supabase Dashboard
-- ============================================

-- 刪除舊表（如果存在）
DROP TABLE IF EXISTS public.user_keywords CASCADE;

-- 創建用戶自定義關鍵字表
CREATE TABLE public.user_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 確保同一用戶不會有重複的關鍵字
  CONSTRAINT unique_user_keyword UNIQUE(user_id, keyword)
);

-- 建立索引以提升查詢效能
CREATE INDEX idx_user_keywords_user_id ON public.user_keywords(user_id);
CREATE INDEX idx_user_keywords_created_at ON public.user_keywords(created_at DESC);
CREATE INDEX idx_user_keywords_keyword ON public.user_keywords(keyword);

-- 啟用 Row Level Security (RLS)
ALTER TABLE public.user_keywords ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Users can view their own keywords" ON public.user_keywords;
DROP POLICY IF EXISTS "Users can insert their own keywords" ON public.user_keywords;
DROP POLICY IF EXISTS "Users can delete their own keywords" ON public.user_keywords;

-- RLS 政策：用戶只能看到自己的關鍵字
CREATE POLICY "Users can view their own keywords"
  ON public.user_keywords
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 政策：用戶只能新增自己的關鍵字
CREATE POLICY "Users can insert their own keywords"
  ON public.user_keywords
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 政策：用戶只能刪除自己的關鍵字
CREATE POLICY "Users can delete their own keywords"
  ON public.user_keywords
  FOR DELETE
  USING (auth.uid() = user_id);

-- 更新 updated_at 的觸發器函數
CREATE OR REPLACE FUNCTION public.update_user_keywords_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS update_user_keywords_updated_at ON public.user_keywords;
CREATE TRIGGER update_user_keywords_updated_at
  BEFORE UPDATE ON public.user_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_keywords_updated_at();

-- 註解
COMMENT ON TABLE public.user_keywords IS '用戶自定義的關鍵字列表';
COMMENT ON COLUMN public.user_keywords.id IS '主鍵 UUID';
COMMENT ON COLUMN public.user_keywords.user_id IS '用戶 ID（關聯 auth.users）';
COMMENT ON COLUMN public.user_keywords.keyword IS '關鍵字內容';
COMMENT ON COLUMN public.user_keywords.created_at IS '創建時間';
COMMENT ON COLUMN public.user_keywords.updated_at IS '最後更新時間';

-- 驗證表格創建
SELECT 
  'user_keywords 表格創建成功！' as message,
  COUNT(*) as initial_count
FROM public.user_keywords;

-- 顯示表格結構
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_keywords'
ORDER BY ordinal_position;
