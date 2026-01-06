import { http } from "./request";

/**
 * 用户登录 (FormData格式)
 */
export const loginApi = (username: string, password: string) => {
  return http.postFormData("/cyUser/login", {
    username,
    password,
  });
};
