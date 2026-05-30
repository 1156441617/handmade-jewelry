const { AIRecommendationEngine, AIContentGenerator } = require('../services/ai.service');
const { query } = require('../config/database');

const recommendationEngine = new AIRecommendationEngine();
const contentGenerator = new AIContentGenerator();

/**
 * 获取个性化推荐
 */
const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const recommendations = await recommendationEngine.getPersonalizedRecommendations(
      userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('Get personalized recommendations error:', error);
    res.status(500).json({
      success: false,
      message: '获取推荐失败',
    });
  }
};

/**
 * 获取相似商品推荐
 */
const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 8 } = req.query;

    const products = await recommendationEngine.getSimilarProducts(
      productId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Get similar products error:', error);
    res.status(500).json({
      success: false,
      message: '获取相似商品失败',
    });
  }
};

/**
 * 获取热门商品
 */
const getTrendingProducts = async (req, res) => {
  try {
    const { limit = 10, days = 7 } = req.query;

    const products = await recommendationEngine.getTrendingProducts(
      parseInt(limit),
      parseInt(days)
    );

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Get trending products error:', error);
    res.status(500).json({
      success: false,
      message: '获取热门商品失败',
    });
  }
};

/**
 * 追踪用户行为
 */
const trackBehavior = async (req, res) => {
  try {
    const userId = req.user.id;
    const { action, productId, metadata } = req.body;

    await recommendationEngine.trackUserBehavior(
      userId,
      action,
      productId,
      metadata || {}
    );

    res.json({
      success: true,
      message: '行为记录成功',
    });
  } catch (error) {
    console.error('Track behavior error:', error);
    res.status(500).json({
      success: false,
      message: '记录失败',
    });
  }
};

/**
 * 生成商品描述
 */
const generateProductDescription = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // 获取商品信息
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商品不存在',
      });
    }

    const product = result.rows[0];
    const generated = await contentGenerator.generateProductDescription(product);

    res.json({
      success: true,
      data: generated,
    });
  } catch (error) {
    console.error('Generate product description error:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
    });
  }
};

/**
 * 生成小红书笔记
 */
const generateXiaohongshuPost = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商品不存在',
      });
    }

    const product = result.rows[0];
    const generated = await contentGenerator.generateXiaohongshuPost(product);

    res.json({
      success: true,
      data: generated,
    });
  } catch (error) {
    console.error('Generate Xiaohongshu post error:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
    });
  }
};

/**
 * 生成抖音脚本
 */
const generateDouyinScript = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商品不存在',
      });
    }

    const product = result.rows[0];
    const generated = await contentGenerator.generateDouyinScript(product);

    res.json({
      success: true,
      data: generated,
    });
  } catch (error) {
    console.error('Generate Douyin script error:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
    });
  }
};

/**
 * 批量生成内容
 */
const generateBulkContent = async (req, res) => {
  try {
    const { productId, types } = req.body;
    
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商品不存在',
      });
    }

    const product = result.rows[0];
    const results = {};

    // 根据请求的类型生成内容
    for (const type of types) {
      switch (type) {
        case 'description':
          results.description = await contentGenerator.generateProductDescription(product);
          break;
        case 'xiaohongshu':
          results.xiaohongshu = await contentGenerator.generateXiaohongshuPost(product);
          break;
        case 'douyin':
          results.douyin = await contentGenerator.generateDouyinScript(product);
          break;
        default:
          break;
      }
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Generate bulk content error:', error);
    res.status(500).json({
      success: false,
      message: '批量生成失败',
    });
  }
};

/**
 * 获取用户行为统计
 */
const getUserBehaviorStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const result = await query(
      `SELECT 
        action,
        COUNT(*) as count,
        COUNT(DISTINCT product_id) as unique_products
       FROM user_behaviors
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY action
       ORDER BY count DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        period: `${days}天`,
        statistics: result.rows,
      },
    });
  } catch (error) {
    console.error('Get user behavior stats error:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
    });
  }
};

module.exports = {
  getPersonalizedRecommendations,
  getSimilarProducts,
  getTrendingProducts,
  trackBehavior,
  generateProductDescription,
  generateXiaohongshuPost,
  generateDouyinScript,
  generateBulkContent,
  getUserBehaviorStats,
};
