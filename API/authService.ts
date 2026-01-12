// 认证服务 - 管理用户登录状态
import { http } from "./request";
const AUTH_KEY = "cine_auth_token";

export interface User {
  username: string;
  email?: string;
}

// 检查是否已登录
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem(AUTH_KEY);
  return !!token;
};

// 登录
export const login = async (username: string, password: string): Promise<boolean> => {
  try {
    // 调用真实的登录API
    const response = await http.postFormData("/cyUser/login", {
      username,
      password,
    });

    const { data } = response;
    if (data && data.msg) {
      // 保存token和用户信息
      localStorage.setItem(AUTH_KEY, data.msg);
      return true;
    }

    return false;
  } catch (error) {
    console.error("登录失败:", error);
    return false;
  }
};

// 登出
export const logout = (): void => {
  localStorage.removeItem(AUTH_KEY);
};
