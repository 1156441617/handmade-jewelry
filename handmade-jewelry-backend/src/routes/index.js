const express = require('express');
const router = express.Router();

// 导入控制器
const authController = require('../controllers/auth.controller');
const productController = require('../controllers/product.controller');
const orderController = require('../controllers/order.controller');
const aiController = require('../controllers/ai.controller');
const platformController = require('../controllers/platform.controller');
const paymentController = require('../controllers/payment.controller');
const { authenticateToken, refreshToken, authorize } = require('../middleware/auth');

// ============================================
// 认证路由
// ============================================
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/refresh-token', refreshToken);
router.get('/auth/me', authenticateToken, authController.getCurrentUser);
router.put('/auth/profile', authenticateToken, authController.updateProfile);
router.post('/auth/change-password', authenticateToken, authController.changePassword);

// ============================================
// 商品路由
// ============================================
router.get('/products', productController.getProducts);
router.get('/products/categories', productController.getCategories);
router.get('/products/:id', productController.getProductById);

// 需要认证的商品操作
router.post('/products/seller-publish', productController.createProductFromSeller);
router.post('/products', authenticateToken, productController.createProduct);
router.put('/products/:id', authenticateToken, productController.updateProduct);
router.delete('/products/:id', authenticateToken, productController.deleteProduct);

// 收藏功能
router.post('/products/:productId/favorite', authenticateToken, productController.addToFavorites);
router.delete('/products/:productId/favorite', authenticateToken, productController.removeFromFavorites);
router.get('/user/favorites', authenticateToken, productController.getFavorites);

// ============================================
// 订单路由
// ============================================
router.post('/orders', authenticateToken, orderController.createOrder);
router.get('/orders', authenticateToken, orderController.getUserOrders);
router.get('/orders/:id', authenticateToken, orderController.getOrderById);
router.post('/orders/:id/cancel', authenticateToken, orderController.cancelOrder);

// ============================================
// 支付路由
// ============================================
router.post('/payments/alipay/create', authenticateToken, paymentController.createAlipayOrder);
router.post('/payments/wechat/create', authenticateToken, paymentController.createWechatOrder);
router.post('/payments/alipay/notify', paymentController.handleAlipayNotify);
router.post('/payments/wechat/notify', paymentController.handleWechatNotify);

// ============================================
// AI推荐和内容生成路由
// ============================================

// 推荐接口
router.get('/recommendations/personalized', authenticateToken, aiController.getPersonalizedRecommendations);
router.get('/products/:productId/similar', aiController.getSimilarProducts);
router.get('/recommendations/trending', aiController.getTrendingProducts);

// 用户行为追踪
router.post('/behaviors/track', authenticateToken, aiController.trackBehavior);
router.get('/behaviors/stats', authenticateToken, aiController.getUserBehaviorStats);

// AI内容生成
router.post('/ai/generate/:productId/description', authenticateToken, aiController.generateProductDescription);
router.post('/ai/generate/:productId/xiaohongshu', authenticateToken, aiController.generateXiaohongshuPost);
router.post('/ai/generate/:productId/douyin', authenticateToken, aiController.generateDouyinScript);
router.post('/ai/generate/bulk', authenticateToken, aiController.generateBulkContent);

// ============================================
// 多平台同步路由
// ============================================

// 商品同步
router.post('/platforms/sync/:productId', authenticateToken, platformController.syncProduct);
router.post('/platforms/sync/:productId/all', authenticateToken, platformController.syncToAllPlatforms);
router.put('/platforms/:platform/products/:productId', authenticateToken, platformController.updatePlatformProduct);
router.delete('/platforms/:platform/products/:productId', authenticateToken, platformController.deletePlatformProduct);

// 同步状态查询
router.get('/platforms/status/:productId', authenticateToken, platformController.getSyncStatus);
router.get('/platforms/pending', authenticateToken, platformController.getPendingSyncProducts);

// 自动同步
router.post('/platforms/auto-sync', authenticateToken, platformController.triggerAutoSync);

// 平台配置管理
router.post('/platforms/config/:platform', authenticateToken, platformController.configurePlatform);
router.get('/platforms/config', authenticateToken, platformController.getPlatformConfigs);

// ============================================
// 健康检查
// ============================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// 管理后台统计API
// ============================================
router.get('/admin/stats', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { query, mockOrders, mockUsers, mockBehaviors } = require('../config/database');
    const { mockData } = require('../services/mock.service');
    
    // 商品总数
    const productCount = mockData.products.length;
    
    // 用户总数
    const userCount = mockUsers.length;
    
    // 订单总数和收入
    const orderCount = mockOrders.length;
    const revenue = mockOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    
    // 今日订单
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = mockOrders.filter(o => o.created_at && o.created_at.startsWith(today));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    
    // 行为统计
    const behaviorStats = {};
    mockBehaviors.forEach(b => {
      behaviorStats[b.action] = (behaviorStats[b.action] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        productCount,
        userCount,
        orderCount,
        revenue: revenue.toFixed(2),
        todayOrderCount: todayOrders.length,
        todayRevenue: todayRevenue.toFixed(2),
        behaviorStats,
        recentOrders: mockOrders.slice(-5).reverse(),
        products: mockData.products,
        users: mockUsers.map(u => ({ id: u.id, email: u.email, username: u.username, role: u.role, created_at: u.created_at })),
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
});

// 管理后台 - 创建测试订单
router.post('/admin/create-test-order', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { mockOrders } = require('../config/database');
    const { mockData } = require('../services/mock.service');
    
    const userId = req.body.userId || 'user-001';
    const productIds = req.body.productIds || ['1'];
    
    let totalAmount = 0;
    const items = [];
    
    for (const pid of productIds) {
      const product = mockData.products.find(p => p.id === pid);
      if (product) {
        const qty = Math.floor(Math.random() * 3) + 1;
        totalAmount += product.price * qty;
        items.push({
          product_id: product.id,
          product_name: product.name,
          product_image: product.mainImage,
          quantity: qty,
          unit_price: product.price,
          subtotal: product.price * qty,
        });
      }
    }
    
    const order = {
      id: `order-${Date.now()}`,
      order_number: `ORD${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(mockOrders.length + 1).padStart(6, '0')}`,
      user_id: userId,
      status: 'pending',
      payment_method: null,
      payment_status: 'pending',
      subtotal: totalAmount,
      shipping_fee: totalAmount >= 99 ? 0 : 10,
      discount_amount: 0,
      total_amount: totalAmount + (totalAmount >= 99 ? 0 : 10),
      items,
      shipping_name: '测试用户',
      shipping_phone: '13800138000',
      shipping_address: '北京市朝阳区测试地址',
      created_at: new Date().toISOString(),
    };
    
    mockOrders.push(order);
    
    res.json({
      success: true,
      message: '测试订单创建成功',
      data: order,
    });
  } catch (error) {
    console.error('Create test order error:', error);
    res.status(500).json({ success: false, message: '创建失败' });
  }
});

module.exports = router;
