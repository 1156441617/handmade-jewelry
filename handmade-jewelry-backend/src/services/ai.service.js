const { query } = require('../config/database');
const { cache } = require('../config/redis');
const axios = require('axios');
require('dotenv').config();

// OpenAI配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE) || 0.7;
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS) || 2000;

/**
 * AI推荐引擎 - 基于用户行为的个性化推荐
 */
class AIRecommendationEngine {
  
  /**
   * 获取个性化推荐商品
   */
  async getPersonalizedRecommendations(userId, limit = 10) {
    try {
      // 检查缓存
      const cacheKey = `recommendations:personalized:${userId}:${limit}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 分析用户行为
      const userProfile = await this.analyzeUserBehavior(userId);
      
      // 基于协同过滤和内容推荐生成推荐列表
      let recommendedProducts = [];
      
      if (userProfile.hasHistory) {
        // 有历史行为:使用协同过滤+内容推荐
        recommendedProducts = await this.hybridRecommendation(userId, userProfile, limit);
      } else {
        // 新用户:使用热门商品和新品推荐
        recommendedProducts = await this.getColdStartRecommendations(limit);
      }

      // 保存推荐结果到缓存(30分钟)
      const result = {
        userId,
        recommendationType: 'personalized',
        products: recommendedProducts,
        generatedAt: new Date().toISOString(),
      };

      await cache.set(cacheKey, result, 1800);

      // 异步保存推荐记录
      this.saveRecommendationRecord(userId, 'personalized', recommendedProducts);

      return result;
    } catch (error) {
      console.error('Get personalized recommendations error:', error);
      throw error;
    }
  }

  /**
   * 分析用户行为画像
   */
  async analyzeUserBehavior(userId) {
    // 获取用户最近的浏览历史
    const viewHistory = await query(
      `SELECT product_id, created_at, metadata
       FROM user_behaviors
       WHERE user_id = $1 AND action = 'view'
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    // 获取用户的收藏
    const favorites = await query(
      `SELECT p.id, p.category_id, p.tags, p.price
       FROM product_favorites pf
       JOIN products p ON pf.product_id = p.id
       WHERE pf.user_id = $1`,
      [userId]
    );

    // 获取用户的购买历史
    const purchases = await query(
      `SELECT oi.product_id, p.category_id, p.tags, p.price, o.created_at
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1 AND o.status = 'delivered'
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [userId]
    );

    // 分析偏好分类
    const categoryPreferences = this.analyzeCategoryPreference(favorites.rows, purchases.rows);
    
    // 分析价格区间
    const priceRange = this.analyzePriceRange(favorites.rows, purchases.rows);
    
    // 分析标签偏好
    const tagPreferences = this.analyzeTagPreference(favorites.rows, purchases.rows);

    return {
      hasHistory: viewHistory.rows.length > 0 || favorites.rows.length > 0 || purchases.rows.length > 0,
      viewCount: viewHistory.rows.length,
      favoriteCount: favorites.rows.length,
      purchaseCount: purchases.rows.length,
      categoryPreferences,
      priceRange,
      tagPreferences,
      recentViews: viewHistory.rows.slice(0, 10),
    };
  }

  /**
   * 分析分类偏好
   */
  analyzeCategoryPreference(favorites, purchases) {
    const categoryScores = {};
    
    // 收藏权重: 3分
    favorites.forEach(item => {
      const catId = item.category_id;
      categoryScores[catId] = (categoryScores[catId] || 0) + 3;
    });
    
    // 购买权重: 5分
    purchases.forEach(item => {
      const catId = item.category_id;
      categoryScores[catId] = (categoryScores[catId] || 0) + 5;
    });

    // 排序并返回前5个偏好分类
    return Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId, score]) => ({ categoryId, score }));
  }

  /**
   * 分析价格区间偏好
   */
  analyzePriceRange(favorites, purchases) {
    const allPrices = [...favorites, ...purchases].map(item => parseFloat(item.price));
    
    if (allPrices.length === 0) {
      return { min: 0, max: 500, avg: 150 };
    }

    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const avg = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

    return {
      min: Math.floor(min),
      max: Math.ceil(max),
      avg: Math.round(avg),
      preferredRange: [avg * 0.7, avg * 1.3], // 偏好区间为平均值的±30%
    };
  }

  /**
   * 分析标签偏好
   */
  analyzeTagPreference(favorites, purchases) {
    const tagScores = {};
    
    // 统计标签出现频率
    [...favorites, ...purchases].forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          tagScores[tag] = (tagScores[tag] || 0) + 1;
        });
      }
    });

    // 返回前10个偏好标签
    return Object.entries(tagScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }

  /**
   * 混合推荐算法(协同过滤 + 内容推荐)
   */
  async hybridRecommendation(userId, userProfile, limit) {
    const candidateProducts = new Map();

    // 1. 基于分类偏好推荐(权重: 40%)
    const categoryBased = await this.getCategoryBasedRecommendations(
      userProfile.categoryPreferences,
      userProfile.priceRange,
      limit * 2
    );
    
    categoryBased.forEach(product => {
      candidateProducts.set(product.id, {
        product,
        score: (product.score || 0) + 40,
      });
    });

    // 2. 基于标签偏好推荐(权重: 30%)
    const tagBased = await this.getTagBasedRecommendations(
      userProfile.tagPreferences,
      limit * 2
    );
    
    tagBased.forEach(product => {
      const existing = candidateProducts.get(product.id);
      if (existing) {
        existing.score += 30;
      } else {
        candidateProducts.set(product.id, {
          product,
          score: 30,
        });
      }
    });

    // 3. 协同过滤:看过这个商品的人也看了(权重: 30%)
    if (userProfile.recentViews.length > 0) {
      const collaborative = await this.getCollaborativeFilteringRecommendations(
        userProfile.recentViews[0].product_id,
        limit * 2
      );
      
      collaborative.forEach(product => {
        const existing = candidateProducts.get(product.id);
        if (existing) {
          existing.score += 30;
        } else {
          candidateProducts.set(product.id, {
            product,
            score: 30,
          });
        }
      });
    }

    // 按分数排序并返回top N
    const sorted = Array.from(candidateProducts.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.product);

    return sorted;
  }

  /**
   * 基于分类的推荐
   */
  async getCategoryBasedRecommendations(categoryPreferences, priceRange, limit) {
    if (categoryPreferences.length === 0) {
      return [];
    }

    const preferredCategories = categoryPreferences.map(cp => cp.categoryId);
    
    const result = await query(
      `SELECT id, name, slug, price, main_image_url, rating_average, category_id
       FROM products
       WHERE category_id = ANY($1::uuid[])
         AND status = 'active'
         AND deleted_at IS NULL
         AND price >= $2
         AND price <= $3
       ORDER BY rating_average DESC, sales_count DESC
       LIMIT $4`,
      [
        preferredCategories,
        priceRange.preferredRange[0],
        priceRange.preferredRange[1],
        limit
      ]
    );

    return result.rows;
  }

  /**
   * 基于标签的推荐
   */
  async getTagBasedRecommendations(tagPreferences, limit) {
    if (tagPreferences.length === 0) {
      return [];
    }

    const preferredTags = tagPreferences.map(tp => tp.tag);

    const result = await query(
      `SELECT DISTINCT p.id, p.name, p.slug, p.price, p.main_image_url, p.rating_average
       FROM products p
       WHERE p.tags && $1::TEXT[]
         AND p.status = 'active'
         AND p.deleted_at IS NULL
       ORDER BY p.rating_average DESC, p.sales_count DESC
       LIMIT $2`,
      [preferredTags, limit]
    );

    return result.rows;
  }

  /**
   * 协同过滤推荐(基于用户行为相似度)
   */
  async getCollaborativeFilteringRecommendations(productId, limit) {
    // 找到看过这个商品的用户还看了什么
    const result = await query(
      `SELECT p.id, p.name, p.slug, p.price, p.main_image_url, p.rating_average, COUNT(*) as similarity_score
       FROM user_behaviors ub1
       JOIN user_behaviors ub2 ON ub1.user_id = ub2.user_id
       JOIN products p ON ub2.product_id = p.id
       WHERE ub1.product_id = $1
         AND ub2.product_id != $1
         AND ub2.action = 'view'
         AND p.status = 'active'
         AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY similarity_score DESC
       LIMIT $2`,
      [productId, limit]
    );

    return result.rows;
  }

  /**
   * 冷启动推荐(新用户)
   */
  async getColdStartRecommendations(limit) {
    // 返回热门商品和新品
    const result = await query(
      `SELECT id, name, slug, price, main_image_url, rating_average, is_new_arrival
       FROM products
       WHERE status = 'active'
         AND deleted_at IS NULL
       ORDER BY 
         CASE WHEN is_new_arrival THEN 1 ELSE 0 END DESC,
         rating_average DESC,
         sales_count DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * 相似商品推荐
   */
  async getSimilarProducts(productId, limit = 8) {
    const cacheKey = `recommendations:similar:${productId}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 获取目标商品信息
    const productResult = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return [];
    }

    const product = productResult.rows[0];

    // 基于分类、标签、价格区间查找相似商品
    const result = await query(
      `SELECT id, name, slug, price, main_image_url, rating_average
       FROM products
       WHERE id != $1
         AND status = 'active'
         AND deleted_at IS NULL
         AND (
           category_id = $2
           OR tags && $3::TEXT[]
         )
         AND price BETWEEN $4 AND $5
       ORDER BY 
         CASE WHEN category_id = $2 THEN 1 ELSE 0 END DESC,
         rating_average DESC
       LIMIT $6`,
      [
        productId,
        product.category_id,
        product.tags,
        product.price * 0.7,
        product.price * 1.3,
        limit
      ]
    );

    const recommendations = result.rows;
    await cache.set(cacheKey, recommendations, 3600); // 缓存1小时

    return recommendations;
  }

  /**
   *  trending推荐(热门商品)
   */
  async getTrendingProducts(limit = 10, days = 7) {
    const cacheKey = `recommendations:trending:${limit}:${days}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await query(
      `SELECT p.id, p.name, p.slug, p.price, p.main_image_url, p.rating_average,
              COUNT(DISTINCT o.id) as order_count,
              SUM(oi.quantity) as total_sold
       FROM products p
       JOIN order_items oi ON p.id = oi.product_id
       JOIN orders o ON oi.order_id = o.id
       WHERE p.status = 'active'
         AND p.deleted_at IS NULL
         AND o.created_at >= NOW() - INTERVAL '1 day' * $2
         AND o.status IN ('delivered', 'shipped', 'processing')
       GROUP BY p.id
       ORDER BY total_sold DESC, order_count DESC
       LIMIT $1`,
      [limit, days]
    );

    const recommendations = result.rows;
    await cache.set(cacheKey, recommendations, 1800);

    return recommendations;
  }

  /**
   * 保存推荐记录
   */
  async saveRecommendationRecord(userId, recommendationType, productIds) {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await query(
        `INSERT INTO recommendations (user_id, recommendation_type, product_ids, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, recommendationType, productIds.map(p => p.id || p), expiresAt]
      );
    } catch (error) {
      console.error('Save recommendation record error:', error);
    }
  }

  /**
   * 追踪用户行为
   */
  async trackUserBehavior(userId, action, productId = null, metadata = {}) {
    try {
      const sessionId = metadata.sessionId || null;
      
      await query(
        `INSERT INTO user_behaviors (user_id, session_id, action, product_id, metadata, ip_address, device_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          sessionId,
          action,
          productId,
          metadata,
          metadata.ipAddress || null,
          metadata.deviceType || null,
        ]
      );

      // 清除相关缓存
      if (action === 'view' && productId) {
        await cache.delPattern(`recommendations:personalized:${userId}:*`);
      }
    } catch (error) {
      console.error('Track user behavior error:', error);
    }
  }
}

/**
 * AI内容生成服务
 */
class AIContentGenerator {
  
  /**
   * 生成商品描述
   */
  async generateProductDescription(productInfo) {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, using template');
      return this.generateTemplateDescription(productInfo);
    }

    try {
      const prompt = this.buildProductDescriptionPrompt(productInfo);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的手作饰品文案策划师,擅长创作吸引人的商品描述。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: AI_TEMPERATURE,
          max_tokens: AI_MAX_TOKENS,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const description = response.data.choices[0].message.content.trim();
      
      // 保存到数据库
      await this.saveGeneratedContent({
        product_id: productInfo.id,
        content_type: 'product_description',
        content: description,
        model_used: OPENAI_MODEL,
        prompt_used: prompt,
      });

      return {
        success: true,
        content: description,
        model: OPENAI_MODEL,
      };
    } catch (error) {
      console.error('Generate product description error:', error);
      // 降级到模板生成
      return {
        success: false,
        content: this.generateTemplateDescription(productInfo),
        model: 'template',
      };
    }
  }

  /**
   * 生成小红书种草笔记
   */
  async generateXiaohongshuPost(productInfo) {
    if (!OPENAI_API_KEY) {
      return this.generateTemplateXiaohongshuPost(productInfo);
    }

    try {
      const prompt = this.buildXiaohongshuPrompt(productInfo);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是小红书爆款文案专家,擅长创作高互动率的种草笔记。风格要亲切自然,多用emoji,包含热门标签。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 1500,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0].message.content.trim();
      
      await this.saveGeneratedContent({
        product_id: productInfo.id,
        content_type: 'social_post',
        target_platform: 'xiaohongshu',
        content: content,
        model_used: OPENAI_MODEL,
      });

      return {
        success: true,
        content,
        platform: 'xiaohongshu',
      };
    } catch (error) {
      console.error('Generate Xiaohongshu post error:', error);
      return {
        success: false,
        content: this.generateTemplateXiaohongshuPost(productInfo),
        platform: 'xiaohongshu',
      };
    }
  }

  /**
   * 生成抖音短视频脚本
   */
  async generateDouyinScript(productInfo) {
    if (!OPENAI_API_KEY) {
      return this.generateTemplateDouyinScript(productInfo);
    }

    try {
      const prompt = this.buildDouyinScriptPrompt(productInfo);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是抖音短视频脚本专家,擅长创作15-30秒的产品展示脚本。要包含镜头语言、台词、BGM建议。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.85,
          max_tokens: 1200,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const script = response.data.choices[0].message.content.trim();
      
      await this.saveGeneratedContent({
        product_id: productInfo.id,
        content_type: 'video_script',
        target_platform: 'douyin',
        content: script,
        model_used: OPENAI_MODEL,
      });

      return {
        success: true,
        content: script,
        platform: 'douyin',
      };
    } catch (error) {
      console.error('Generate Douyin script error:', error);
      return {
        success: false,
        content: this.generateTemplateDouyinScript(productInfo),
        platform: 'douyin',
      };
    }
  }

  /**
   * 构建商品描述Prompt
   */
  buildProductDescriptionPrompt(productInfo) {
    return `请为以下手作饰品创作一段吸引人的商品描述:

商品名称: ${productInfo.name}
材质: ${productInfo.material || '未指定'}
特点: ${(productInfo.tags || []).join(', ')}
价格: ¥${productInfo.price}
目标客户: 18-35岁女性,喜欢独特设计,注重品质

要求:
1. 突出手工制作的独特性和匠心精神
2. 强调材质的优质和安全
3. 描述佩戴场景和搭配建议
4. 传达情感价值和故事性
5. 字数控制在200-300字
6. 语言优美,有感染力`;
  }

  /**
   * 构建小红书笔记Prompt
   */
  buildXiaohongshuPrompt(productInfo) {
    return `请为以下手作饰品创作一篇小红书种草笔记:

商品: ${productInfo.name}
特点: ${(productInfo.tags || []).join(', ')}
价格: ¥${productInfo.price}

要求:
1. 标题要吸引眼球,包含emoji
2. 正文亲切自然,像闺蜜分享
3. 包含使用体验和感受
4. 给出搭配建议
5. 结尾引导互动(点赞、收藏、评论)
6. 添加5-8个相关话题标签
7. 全文300-500字,适当使用emoji`;
  }

  /**
   * 构建抖音脚本Prompt
   */
  buildDouyinScriptPrompt(productInfo) {
    return `请为以下手作饰品创作一个15-30秒的抖音短视频脚本:

商品: ${productInfo.name}
卖点: ${(productInfo.tags || []).join(', ')}
价格: ¥${productInfo.price}

要求:
1. 包含详细的镜头描述(景别、角度、运动)
2. 每段台词要简短有力
3. BGM风格建议
4. 特效和转场建议
5. 要有悬念或反转
6. 结尾引导购买`;
  }

  /**
   * 模板方式生成商品描述(降级方案)
   */
  generateTemplateDescription(productInfo) {
    return `【${productInfo.name}】

✨ 产品亮点：
• 纯手工制作，每一件都是独一无二的艺术品
• 精选${productInfo.material || '优质材料'}，安全舒适
• 独特设计，彰显个性品味

💎 材质说明：
采用${productInfo.material || '高品质材料'}，经过精心打磨和处理，确保佩戴舒适度和耐久性。

🎨 设计理念：
融合现代美学与传统工艺，每一个细节都体现匠人精神。适合日常佩戴或作为礼物赠送。

💝 适用场景：
约会、聚会、通勤、休闲等多种场合，百搭款式轻松驾驭各种风格。

📦 包装服务：
精美礼盒包装，附送保养说明卡，送礼自用两相宜。`;
  }

  /**
   * 模板方式生成小红书笔记
   */
  generateTemplateXiaohongshuPost(productInfo) {
    return `✨被问爆的${productInfo.name}!真的绝美😍

姐妹们!今天必须给你们安利这款让我一眼心动的${productInfo.name}!💕

🌟 关于材质
选用${productInfo.material || '优质材料'},质感满分~ 

🎨 设计亮点
设计师用心之作,每一个细节都很精致。戴上超级显气质,百搭不挑人!

💝 使用感受
佩戴舒适,不会过敏。阳光下特别闪,拍照超好看!

👗 搭配建议
搭配小裙子是仙女本仙,搭配衬衫又多了几分知性美~日常通勤、约会都能hold住!

🎁 现在下单还送精美礼盒包装哦!

#${productInfo.tags ? productInfo.tags.join(' #') : '手作饰品 #小众设计 #高级感配饰'}`;
  }

  /**
   * 模板方式生成抖音脚本
   */
  generateTemplateDouyinScript(productInfo) {
    return `【${productInfo.name}】抖音短视频脚本

时长: 20秒
BGM: 轻快浪漫的音乐

镜头1 (0-3秒):
- 特写镜头,缓慢旋转展示商品
- 台词:"你见过会发光的首饰吗?"

镜头2 (3-8秒):
- 中景,模特佩戴展示
- 台词:"纯手工打造的${productInfo.name},每一处细节都是匠心的体现"

镜头3 (8-13秒):
- 近景,展示材质细节
- 台词:"${productInfo.material || '精选材质'},戴着舒适不过敏"

镜头4 (13-17秒):
- 全景,多场景切换
- 台词:"约会、通勤、聚会,怎么搭都好看"

镜头5 (17-20秒):
- 特写+价格展示
- 台词:"限时特价¥${productInfo.price},点击左下角get同款!"`;
  }

  /**
   * 保存生成的内容
   */
  async saveGeneratedContent(data) {
    try {
      await query(
        `INSERT INTO ai_generated_content (
          product_id, content_type, target_platform, content, 
          model_used, prompt_used, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'draft')`,
        [
          data.product_id,
          data.content_type,
          data.target_platform || null,
          data.content,
          data.model_used,
          data.prompt_used || null,
        ]
      );
    } catch (error) {
      console.error('Save generated content error:', error);
    }
  }
}

module.exports = {
  AIRecommendationEngine,
  AIContentGenerator,
};
