import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: "https://www.i-oranges.com/cyinside",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 检查是否为登录请求
    const isLoginRequest = config.url?.includes("/cyUser/login");
    if (!isLoginRequest) {
      const token = localStorage.getItem("cine_auth_token");
      if (!token) {
        setTimeout(() => {
          window.location.reload();
        }, 2500);
        return Promise.reject(new Error("请重新登录"));
      }

      // 如果有 token，添加到请求头
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    console.error("请求错误:", error);
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data;
    if (res.code && res.code !== 20000) {
      console.error("业务错误:", res.message || "请求失败");
      return Promise.reject(new Error(res.message || "请求失败"));
    }

    return response;
  },
  (error) => {
    console.error("响应错误:", error);
    // 统一处理错误状态码
    if (error.response) {
      switch (error.response.status) {
        case 401:
          console.error("未授权，请重新登录");
          // 可以在这里清除token并跳转到登录页
          localStorage.removeItem("cine_auth_token");
          localStorage.removeItem("cine_user");
          break;
        case 403:
          console.error("拒绝访问");
          break;
        case 404:
          console.error("请求错误，未找到该资源");
          break;
        case 500:
          console.error("服务器错误");
          break;
        default:
          console.error(`连接错误：${error.response.status}`);
      }
    } else if (error.request) {
      console.error("网络错误，请检查网络连接");
    }

    return Promise.reject(error);
  }
);

// 封装常用的请求方法
export const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return request.get(url, config);
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return request.post(url, data, config);
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return request.put(url, data, config);
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return request.delete(url, config);
  },
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return request.patch(url, data, config);
  },

  /**
   * FormData请求 (用于文件上传等)
   */
  postFormData<T = any>(url: string, data: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const formData = new FormData();
    // 将数据转换为FormData格式
    Object.keys(data).forEach((key) => {
      formData.append(key, data[key]);
    });

    return request.post(url, formData, {
      ...config,
      headers: {
        "Content-Type": "multipart/form-data",
        ...config?.headers,
      },
    });
  },
};

export default request;
