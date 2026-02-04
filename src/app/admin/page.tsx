'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface UserUsage {
  id: string;
  user_id: string;
  email: string;
  usage_count: number;
  max_usage: number;
  is_premium: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAdminAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }

      setCurrentUser(session.user);

      // 檢查是否為管理員
      const adminEmails = ['jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com'];
      if (!adminEmails.includes(session.user.email || '')) {
        setMessage('您沒有管理員權限');
        return;
      }

      await fetchUsers();
    };

    checkAdminAuth();
  }, [router, supabase.auth]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_usage')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      setMessage(`獲取用戶列表失敗: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateUserUsage = async (userId: string, maxUsage: number, isPremium: boolean) => {
    try {
      const { error } = await supabase
        .from('user_usage')
        .update({ 
          max_usage: maxUsage,
          is_premium: isPremium
        })
        .eq('user_id', userId);

      if (error) throw error;
      
      setMessage('用戶設定更新成功');
      await fetchUsers();
    } catch (error: any) {
      setMessage(`更新失敗: ${error.message}`);
    }
  };

  const resetUserUsage = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_usage')
        .update({ usage_count: 0 })
        .eq('user_id', userId);

      if (error) throw error;
      
      setMessage('使用次數重置成功');
      await fetchUsers();
    } catch (error: any) {
      setMessage(`重置失敗: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">載入中...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !['jg971402@gmail.com', 'dustin@growthmarketing.tw', 'admin@example.com'].includes(currentUser.email || '')) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">權限不足</h1>
          <p className="text-slate-600 mb-4">您沒有管理員權限</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800">用戶管理後台</h1>
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                返回首頁
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                登出
              </button>
            </div>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.includes('成功') 
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">用戶信箱</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">使用次數</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">最大次數</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">會員狀態</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">最後使用</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-900">{user.email}</div>
                      <div className="text-xs text-slate-500">{user.user_id}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`font-bold ${
                        user.usage_count >= user.max_usage ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {user.usage_count}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <input
                        type="number"
                        value={user.max_usage}
                        onChange={(e) => {
                          const newMaxUsage = parseInt(e.target.value) || 0;
                          updateUserUsage(user.user_id, newMaxUsage, user.is_premium);
                        }}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                        min="0"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={user.is_premium}
                          onChange={(e) => {
                            updateUserUsage(user.user_id, user.max_usage, e.target.checked);
                          }}
                          className="mr-2"
                        />
                        <span className={user.is_premium ? 'text-yellow-600 font-bold' : 'text-slate-500'}>
                          {user.is_premium ? '👑 Premium' : '一般用戶'}
                        </span>
                      </label>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-500">
                      {user.last_used_at 
                        ? new Date(user.last_used_at).toLocaleString('zh-TW')
                        : '從未使用'
                      }
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => resetUserUsage(user.user_id)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        重置次數
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              目前沒有用戶資料
            </div>
          )}
        </div>
      </div>
    </div>
  );
}