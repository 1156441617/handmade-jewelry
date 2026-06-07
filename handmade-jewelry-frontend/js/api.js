// ============================================
// 手作饰品电商 - API服务层
// ============================================

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api/v1'
    : '/api/v1';

// Token管理
const TokenManager = {
    getAccessToken() {
        return localStorage.getItem('accessToken');
    },
    getRefreshToken() {
        return localStorage.getItem('refreshToken');
    },
    setTokens(accessToken, refreshToken) {
        localStorage.setItem('accessToken', accessToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    },
    clearTokens() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    },
    isLoggedIn() {
        return !!this.getAccessToken();
    }
};

// Token刷新锁，防止并发刷新
let isRefreshing = false;
let refreshSubscribers = [];

function onTokenRefreshed(newToken) {
    refreshSubscribers.forEach(cb => cb(newToken));
    refreshSubscribers = [];
}

function addRefreshSubscriber(callback) {
    refreshSubscribers.push(callback);
}

// 通用请求方法
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    const token = TokenManager.getAccessToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });
        
        const data = await response.json();
        
        if (response.status === 403 && data.message === '令牌已过期') {
            if (isRefreshing) {
                return new Promise(function(resolve) {
                    addRefreshSubscriber(function(newToken) {
                        headers['Authorization'] = `Bearer ${newToken}`;
                        fetch(url, { ...options, headers }).then(function(retryResponse) {
                            resolve(retryResponse.json());
                        });
                    });
                });
            }
            
            isRefreshing = true;
            const refreshed = await refreshToken();
            isRefreshing = false;
            
            if (refreshed) {
                const newToken = TokenManager.getAccessToken();
                onTokenRefreshed(newToken);
                headers['Authorization'] = `Bearer ${newToken}`;
                const retryResponse = await fetch(url, { ...options, headers });
                return await retryResponse.json();
            }
        }
        
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        return { success: false, message: '网络请求失败，请检查后端服务是否启动' };
    }
}

// 刷新Token
async function refreshToken() {
    const refreshTokenValue = TokenManager.getRefreshToken();
    if (!refreshTokenValue) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: refreshTokenValue }),
        });
        
        const data = await response.json();
        if (data.success) {
            TokenManager.setTokens(data.data.accessToken, data.data.refreshToken);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

// ============================================
// 认证API
// ============================================
const AuthAPI = {
    // 登录
    async login(email, password) {
        const result = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        
        if (result.success) {
            TokenManager.setTokens(result.data.accessToken, result.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(result.data.user));
        }
        
        return result;
    },
    
    // 注册
    async register(email, password, username) {
        const result = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, username }),
        });
        
        if (result.success) {
            TokenManager.setTokens(result.data.accessToken, result.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(result.data.user));
        }
        
        return result;
    },
    
    // 登出
    async logout() {
        const result = await apiRequest('/auth/logout', { method: 'POST' });
        TokenManager.clearTokens();
        localStorage.removeItem('user');
        return result;
    },
    
    // 获取当前用户
    async getCurrentUser() {
        return await apiRequest('/auth/me');
    },
    
    // 更新用户资料
    async updateProfile(data) {
        return await apiRequest('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    
    // 修改密码
    async changePassword(currentPassword, newPassword) {
        return await apiRequest('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    },
};

// ============================================
// 商品API
// ============================================
const ProductAPI = {
    // 获取商品列表
    async getProducts(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await apiRequest(`/products${query ? '?' + query : ''}`);
    },
    
    // 获取商品详情
    async getProductById(id) {
        return await apiRequest(`/products/${id}`);
    },
    
    // 获取分类列表
    async getCategories() {
        return await apiRequest('/products/categories');
    },
    
    // 添加收藏
    async addToFavorites(productId) {
        return await apiRequest(`/products/${productId}/favorite`, { method: 'POST' });
    },
    
    // 取消收藏
    async removeFromFavorites(productId) {
        return await apiRequest(`/products/${productId}/favorite`, { method: 'DELETE' });
    },
    
    // 获取收藏列表
    async getFavorites() {
        return await apiRequest('/user/favorites');
    },
};

// ============================================
// 订单API
// ============================================
const OrderAPI = {
    // 创建订单
    async createOrder(orderData) {
        return await apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData),
        });
    },
    
    // 获取订单列表
    async getOrders(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await apiRequest(`/orders${query ? '?' + query : ''}`);
    },
    
    // 获取订单详情
    async getOrderById(id) {
        return await apiRequest(`/orders/${id}`);
    },
    
    // 取消订单
    async cancelOrder(id, reason) {
        return await apiRequest(`/orders/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    },
};

// ============================================
// 支付API
// ============================================
const PaymentAPI = {
    // 创建支付宝订单
    async createAlipayOrder(orderId) {
        return await apiRequest('/payments/alipay/create', {
            method: 'POST',
            body: JSON.stringify({ orderId }),
        });
    },
    
    // 创建微信支付订单
    async createWechatOrder(orderId) {
        return await apiRequest('/payments/wechat/create', {
            method: 'POST',
            body: JSON.stringify({ orderId }),
        });
    },
};

// ============================================
// AI推荐API
// ============================================
const AIAPI = {
    // 个性化推荐
    async getPersonalizedRecommendations(limit = 10) {
        return await apiRequest(`/recommendations/personalized?limit=${limit}`);
    },
    
    // 相似商品推荐
    async getSimilarProducts(productId, limit = 8) {
        return await apiRequest(`/products/${productId}/similar?limit=${limit}`);
    },
    
    // 热门商品
    async getTrendingProducts(limit = 10) {
        return await apiRequest(`/recommendations/trending?limit=${limit}`);
    },
    
    // 追踪用户行为
    async trackBehavior(action, productId, metadata = {}) {
        return await apiRequest('/behaviors/track', {
            method: 'POST',
            body: JSON.stringify({ action, productId, metadata }),
        });
    },
    
    // 获取用户行为统计
    async getBehaviorStats(days = 30) {
        return await apiRequest(`/behaviors/stats?days=${days}`);
    },
    
    // AI生成商品描述
    async generateProductDescription(productId) {
        return await apiRequest(`/ai/generate/${productId}/description`, { method: 'POST' });
    },
    
    // AI生成小红书笔记
    async generateXiaohongshuPost(productId) {
        return await apiRequest(`/ai/generate/${productId}/xiaohongshu`, { method: 'POST' });
    },
    
    // AI生成抖音脚本
    async generateDouyinScript(productId) {
        return await apiRequest(`/ai/generate/${productId}/douyin`, { method: 'POST' });
    },
    
    // 批量生成内容
    async generateBulkContent(productId, types) {
        return await apiRequest('/ai/generate/bulk', {
            method: 'POST',
            body: JSON.stringify({ productId, types }),
        });
    },
};

// ============================================
// 平台同步API
// ============================================
const PlatformAPI = {
    // 同步商品到指定平台
    async syncProduct(productId, platform) {
        return await apiRequest(`/platforms/sync/${productId}`, {
            method: 'POST',
            body: JSON.stringify({ platform }),
        });
    },
    
    // 同步到所有平台
    async syncToAllPlatforms(productId) {
        return await apiRequest(`/platforms/sync/${productId}/all`, { method: 'POST' });
    },
    
    // 获取同步状态
    async getSyncStatus(productId) {
        return await apiRequest(`/platforms/status/${productId}`);
    },
    
    // 获取平台配置
    async getPlatformConfigs() {
        return await apiRequest('/platforms/config');
    },
    
    // 配置平台
    async configurePlatform(platform, config) {
        return await apiRequest(`/platforms/config/${platform}`, {
            method: 'POST',
            body: JSON.stringify(config),
        });
    },
    
    // 触发自动同步
    async triggerAutoSync() {
        return await apiRequest('/platforms/auto-sync', { method: 'POST' });
    },
};

// ============================================
// 管理后台API
// ============================================
const AdminAPI = {
    // 获取统计数据
    async getStats() {
        return await apiRequest('/admin/stats');
    },
    
    // 创建测试订单
    async createTestOrder(productIds) {
        return await apiRequest('/admin/create-test-order', {
            method: 'POST',
            body: JSON.stringify({ productIds }),
        });
    },
    
    // 健康检查
    async healthCheck() {
        return await apiRequest('/health');
    },
};
