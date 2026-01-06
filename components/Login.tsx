import React, { useState } from 'react';
import { login } from '../API/authService';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        onLoginSuccess();
      } else {
        setError('登录失败，请检查用户名和密码');
      }
    } catch (err) {
      setError('登录时发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-cine-black">
      <div className="w-full max-w-xl px-8">
        <div className="bg-cine-dark border border-cine-border rounded-lg p-8 shadow-2xl">
          {/* 标题 */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <span className="w-2.5 h-2.5 bg-cine-accent rounded-[1px]"></span>
              <h1 className="text-white text-2xl font-bold tracking-[0.15em] uppercase font-mono">
                橙意机构
              </h1>
            </div>
            <p className="text-zinc-400 text-sm font-mono">请登录以继续</p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-lg text-zinc-400 font-mono uppercase tracking-wider mb-2">
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 text-white placeholder-zinc-500 rounded-sm focus:outline-none focus:border-cine-accent focus:ring-1 focus:ring-cine-accent/20 font-mono text-sm transition-all"
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-lg text-zinc-400 font-mono uppercase tracking-wider mb-2">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 text-white placeholder-zinc-500 rounded-sm focus:outline-none focus:border-cine-accent focus:ring-1 focus:ring-cine-accent/20 font-mono text-sm transition-all"
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-500/30 text-red-200 rounded-sm text-xs font-mono">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full text-2xl"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

