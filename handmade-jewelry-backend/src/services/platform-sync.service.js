const { query } = require('../config/database');
const { cache } = require('../config/redis');
const axios = require('axios');
require('dotenv').config();

/**
 * 多平台数据同步服务
 * 支持抖音、小红书、淘宝等平台
 */
class PlatformSyncService {
  
  /**
   * 同步商品到指定平台
   */
  async syncProductToPlatform(productId, platform) {
    try {
      // 获取商品信息
      const productResult = await query(
        'SELECT * FROM products WHERE id = $1',
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error('商品不存在');
      }

      const product = productResult.rows[0];

      // 根据不同平台调用对应的同步方法
      let syncResult;
      switch (platform) {
        case 'douyin':
          syncResult = await this.syncToDouyin(product);
          break;
        case 'xiaohongshu':
          syncResult = await this.syncToXiaohongshu(product);
          break;
        case 'taobao':
          syncResult = await this.syncToTaobao(product);
          break;
        default:
          throw new Error(`不支持的平台: ${platform}`);
      }

      // 保存同步记录
      await this.saveSyncRecord(productId, platform, syncResult);

      return {
        success: true,
        platform,
        data: syncResult,
      };
    } catch (error) {
      console.error(`Sync to ${platform} error:`, error);
      
      // 保存失败记录
      await this.saveSyncRecord(productId, platform, {
        success: false,
        error: error.message,
      });

      return {
        success: false,
        platform,
        error: error.message,
      };
    }
  }

  /**
   * 同步到抖音小店
   */
  async syncToDouyin(product) {
    const appKey = process.env.DOUYIN_APP_KEY;
    const appSecret = process.env.DOUYIN_APP_SECRET;

    if (!appKey || !appSecret) {
      // 模拟同步(开发环境)
      return this.mockSyncToPlatform('douyin', product);
    }

    try {
      // 构建抖音商品数据
      const douyinProduct = {
        product_name: product.name,
        description: product.description,
        category_id: await this.getDouyinCategoryId(product.category_id),
        price: Math.round(product.price * 100), // 转换为分
        stock_num: product.stock_quantity,
        img_urls: product.image_urls || [product.main_image_url],
        detail_imgs: product.image_urls || [],
      };

      // 调用抖音API
      const response = await axios.post(
        'https://openapi.douyin.com/product/add',
        douyinProduct,
        {
          headers: {
            'Authorization': `Bearer ${await this.getDouyinAccessToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        platform_product_id: response.data.data.product_id,
        platform_product_url: `https://haohuo.jinritemai.com/views/product/detail?id=${response.data.data.product_id}`,
      };
    } catch (error) {
      throw new Error(`抖音同步失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 同步到小红书
   */
  async syncToXiaohongshu(product) {
    const appKey = process.env.XIAOHONGSHU_APP_KEY;
    const appSecret = process.env.XIAOHONGSHU_APP_SECRET;

    if (!appKey || !appSecret) {
      return this.mockSyncToPlatform('xiaohongshu', product);
    }

    try {
      // 构建小红书商品数据
      const xhsProduct = {
        title: product.name,
        desc: product.description,
        category_id: await this.getXiaohongshuCategoryId(product.category_id),
        price: product.price * 100,
        stock: product.stock_quantity,
        images: product.image_urls || [product.main_image_url],
      };

      const response = await axios.post(
        'https://edith.xiaohongshu.com/api/goods/create',
        xhsProduct,
        {
          headers: {
            'Authorization': `Bearer ${await this.getXiaohongshuAccessToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        platform_product_id: response.data.data.goods_id,
        platform_product_url: `https://www.xiaohongshu.com/goods/${response.data.data.goods_id}`,
      };
    } catch (error) {
      throw new Error(`小红书同步失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 同步到淘宝
   */
  async syncToTaobao(product) {
    const appKey = process.env.TAOBAO_APP_KEY;
    const appSecret = process.env.TAOBAO_APP_SECRET;

    if (!appKey || !appSecret) {
      return this.mockSyncToPlatform('taobao', product);
    }

    try {
      // 构建淘宝商品数据
      const taobaoProduct = {
        title: product.name,
        desc: product.detail_html || product.description,
        cid: await this.getTaobaoCategoryId(product.category_id),
        price: product.price,
        num: product.stock_quantity,
        pics: product.image_urls || [product.main_image_url],
      };

      const response = await axios.post(
        'https://eco.taobao.com/router/rest',
        {
          method: 'taobao.item.add',
          ...taobaoProduct,
        },
        {
          headers: {
            'Authorization': `Bearer ${await this.getTaobaoAccessToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        platform_product_id: response.data.item_add_response.num_iid,
        platform_product_url: `https://item.taobao.com/item.htm?id=${response.data.item_add_response.num_iid}`,
      };
    } catch (error) {
      throw new Error(`淘宝同步失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 批量同步商品到所有平台
   */
  async syncProductToAllPlatforms(productId) {
    const platforms = ['douyin', 'xiaohongshu', 'taobao'];
    const results = [];

    for (const platform of platforms) {
      try {
        const result = await this.syncProductToPlatform(productId, platform);
        results.push(result);
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * 更新平台商品
   */
  async updatePlatformProduct(productId, platform, updates) {
    try {
      // 获取平台映射信息
      const mappingResult = await query(
        'SELECT * FROM platform_product_mappings WHERE product_id = $1 AND platform = $2',
        [productId, platform]
      );

      if (mappingResult.rows.length === 0) {
        throw new Error('商品未同步到该平台');
      }

      const mapping = mappingResult.rows[0];
      const platformProductId = mapping.platform_product_id;

      // 根据不同平台调用更新API
      let updateResult;
      switch (platform) {
        case 'douyin':
          updateResult = await this.updateDouyinProduct(platformProductId, updates);
          break;
        case 'xiaohongshu':
          updateResult = await this.updateXiaohongshuProduct(platformProductId, updates);
          break;
        case 'taobao':
          updateResult = await this.updateTaobaoProduct(platformProductId, updates);
          break;
      }

      // 更新同步状态
      await query(
        `UPDATE platform_product_mappings 
         SET sync_status = 'synced', last_sync_at = NOW(), updated_at = NOW()
         WHERE product_id = $1 AND platform = $2`,
        [productId, platform]
      );

      return {
        success: true,
        platform,
        data: updateResult,
      };
    } catch (error) {
      console.error(`Update platform product error:`, error);
      
      await query(
        `UPDATE platform_product_mappings 
         SET sync_status = 'failed', sync_error = $3, updated_at = NOW()
         WHERE product_id = $1 AND platform = $2`,
        [productId, platform, error.message]
      );

      return {
        success: false,
        platform,
        error: error.message,
      };
    }
  }

  /**
   * 从平台删除商品
   */
  async deletePlatformProduct(productId, platform) {
    try {
      const mappingResult = await query(
        'SELECT * FROM platform_product_mappings WHERE product_id = $1 AND platform = $2',
        [productId, platform]
      );

      if (mappingResult.rows.length === 0) {
        return { success: true, message: '商品未在该平台同步' };
      }

      const mapping = mappingResult.rows[0];

      // 调用平台删除API
      await this.callPlatformDeleteAPI(platform, mapping.platform_product_id);

      // 删除映射记录
      await query(
        'DELETE FROM platform_product_mappings WHERE product_id = $1 AND platform = $2',
        [productId, platform]
      );

      return {
        success: true,
        platform,
        message: '删除成功',
      };
    } catch (error) {
      console.error(`Delete from ${platform} error:`, error);
      return {
        success: false,
        platform,
        error: error.message,
      };
    }
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(productId) {
    const result = await query(
      `SELECT platform, platform_product_id, platform_product_url, 
              sync_status, last_sync_at, sync_error
       FROM platform_product_mappings
       WHERE product_id = $1
       ORDER BY platform`,
      [productId]
    );

    return {
      success: true,
      data: result.rows,
    };
  }

  /**
   * 获取待同步商品列表
   */
  async getPendingSyncProducts(platform, limit = 50) {
    const result = await query(
      `SELECT p.*
       FROM products p
       LEFT JOIN platform_product_mappings ppm 
         ON p.id = ppm.product_id AND ppm.platform = $1
       WHERE p.status = 'active'
         AND p.deleted_at IS NULL
         AND (ppm.id IS NULL OR ppm.sync_status IN ('pending', 'failed', 'needs_update'))
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [platform, limit]
    );

    return result.rows;
  }

  /**
   * 自动同步任务(定时执行)
   */
  async runAutoSync() {
    console.log('Starting auto sync task...');
    
    const platforms = ['douyin', 'xiaohongshu', 'taobao'];
    let totalSynced = 0;
    let totalFailed = 0;

    for (const platform of platforms) {
      try {
        // 获取平台配置
        const configResult = await query(
          'SELECT * FROM platform_integrations WHERE platform = $1 AND is_active = true',
          [platform]
        );

        if (configResult.rows.length === 0) {
          console.log(`Platform ${platform} not configured, skipping`);
          continue;
        }

        const config = configResult.rows[0];

        // 检查是否到达同步间隔
        if (config.last_sync_at) {
          const minutesSinceLastSync = (Date.now() - new Date(config.last_sync_at).getTime()) / 1000 / 60;
          if (minutesSinceLastSync < config.sync_interval_minutes) {
            continue;
          }
        }

        // 获取待同步商品
        const pendingProducts = await this.getPendingSyncProducts(platform, 100);

        console.log(`Syncing ${pendingProducts.length} products to ${platform}...`);

        for (const product of pendingProducts) {
          try {
            await this.syncProductToPlatform(product.id, platform);
            totalSynced++;
          } catch (error) {
            console.error(`Failed to sync product ${product.id} to ${platform}:`, error);
            totalFailed++;
          }
        }

        // 更新最后同步时间
        await query(
          'UPDATE platform_integrations SET last_sync_at = NOW() WHERE platform = $1',
          [platform]
        );

      } catch (error) {
        console.error(`Auto sync error for ${platform}:`, error);
      }
    }

    console.log(`Auto sync completed: ${totalSynced} synced, ${totalFailed} failed`);
    
    return {
      totalSynced,
      totalFailed,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 模拟同步(开发环境使用)
   */
  mockSyncToPlatform(platform, product) {
    console.log(`[Mock] Syncing product ${product.id} to ${platform}`);
    
    return {
      success: true,
      platform_product_id: `${platform}_${Date.now()}`,
      platform_product_url: `https://${platform}.com/product/${Date.now()}`,
      mock: true,
    };
  }

  /**
   * 保存同步记录
   */
  async saveSyncRecord(productId, platform, result) {
    const status = result.success ? 'synced' : 'failed';
    const error = result.error || null;

    await query(
      `INSERT INTO platform_product_mappings 
        (product_id, platform, platform_product_id, platform_product_url, sync_status, sync_error)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (product_id, platform) 
       DO UPDATE SET 
         platform_product_id = EXCLUDED.platform_product_id,
         platform_product_url = EXCLUDED.platform_product_url,
         sync_status = EXCLUDED.sync_status,
         sync_error = EXCLUDED.sync_error,
         last_sync_at = NOW(),
         updated_at = NOW()`,
      [
        productId,
        platform,
        result.platform_product_id || null,
        result.platform_product_url || null,
        status,
        error,
      ]
    );
  }

  /**
   * 获取访问令牌(简化版,实际应实现OAuth流程)
   */
  async getDouyinAccessToken() {
    return process.env.DOUYIN_ACCESS_TOKEN || 'mock_token';
  }

  async getXiaohongshuAccessToken() {
    return process.env.XIAOHONGSHU_ACCESS_TOKEN || 'mock_token';
  }

  async getTaobaoAccessToken() {
    return process.env.TAOBAO_ACCESS_TOKEN || 'mock_token';
  }

  /**
   * 获取平台分类ID映射
   */
  async getDouyinCategoryId(localCategoryId) {
    // 实际应维护分类映射表
    return 'local_category_' + localCategoryId;
  }

  async getXiaohongshuCategoryId(localCategoryId) {
    return 'local_category_' + localCategoryId;
  }

  async getTaobaoCategoryId(localCategoryId) {
    return 'local_category_' + localCategoryId;
  }

  /**
   * 调用平台删除API
   */
  async callPlatformDeleteAPI(platform, platformProductId) {
    console.log(`[Mock] Deleting product from ${platform}: ${platformProductId}`);
    // 实际应调用各平台的删除API
  }

  /**
   * 更新抖音商品
   */
  async updateDouyinProduct(platformProductId, updates) {
    console.log(`[Mock] Updating Douyin product: ${platformProductId}`);
    return { success: true };
  }

  /**
   * 更新小红书商品
   */
  async updateXiaohongshuProduct(platformProductId, updates) {
    console.log(`[Mock] Updating Xiaohongshu product: ${platformProductId}`);
    return { success: true };
  }

  /**
   * 更新淘宝商品
   */
  async updateTaobaoProduct(platformProductId, updates) {
    console.log(`[Mock] Updating Taobao product: ${platformProductId}`);
    return { success: true };
  }
}

module.exports = {
  PlatformSyncService,
};
