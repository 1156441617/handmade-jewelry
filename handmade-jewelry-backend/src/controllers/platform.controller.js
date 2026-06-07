const { PlatformSyncService } = require('../services/platform-sync.service');
const { query } = require('../config/database');

const platformSyncService = new PlatformSyncService();

/**
 * 同步商品到指定平台
 */
const syncProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { platform } = req.body;

    if (!platform || !['douyin', 'xiaohongshu', 'taobao'].includes(platform)) {
      return res.status(400).json({
        success: false,
        errorCode: 'PLATFORM_INVALID_PLATFORM',
        message: '请指定有效的平台(douyin/xiaohongshu/taobao)',
      });
    }

    const result = await platformSyncService.syncProductToPlatform(productId, platform);

    res.json(result);
  } catch (error) {
    console.error('Sync product error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_SYNC_FAILED',
      message: error.message,
    });
  }
};

/**
 * 批量同步到所有平台
 */
const syncToAllPlatforms = async (req, res) => {
  try {
    const { productId } = req.params;

    const results = await platformSyncService.syncProductToAllPlatforms(productId);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Sync to all platforms error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_SYNC_ALL_FAILED',
      message: error.message,
    });
  }
};

/**
 * 更新平台商品
 */
const updatePlatformProduct = async (req, res) => {
  try {
    const { productId, platform } = req.params;
    const updates = req.body;

    const result = await platformSyncService.updatePlatformProduct(productId, platform, updates);

    res.json(result);
  } catch (error) {
    console.error('Update platform product error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_UPDATE_FAILED',
      message: error.message,
    });
  }
};

/**
 * 从平台删除商品
 */
const deletePlatformProduct = async (req, res) => {
  try {
    const { productId, platform } = req.params;

    const result = await platformSyncService.deletePlatformProduct(productId, platform);

    res.json(result);
  } catch (error) {
    console.error('Delete platform product error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_DELETE_FAILED',
      message: error.message,
    });
  }
};

/**
 * 获取同步状态
 */
const getSyncStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await platformSyncService.getSyncStatus(productId);

    res.json(result);
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_STATUS_FAILED',
      message: error.message,
    });
  }
};

/**
 * 获取待同步商品列表
 */
const getPendingSyncProducts = async (req, res) => {
  try {
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({
        success: false,
        errorCode: 'PLATFORM_PLATFORM_REQUIRED',
        message: '请指定平台',
      });
    }

    const products = await platformSyncService.getPendingSyncProducts(platform, 50);

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error('Get pending sync products error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_PENDING_FAILED',
      message: error.message,
    });
  }
};

/**
 * 手动触发自动同步
 */
const triggerAutoSync = async (req, res) => {
  try {
    const result = await platformSyncService.runAutoSync();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Trigger auto sync error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_AUTO_SYNC_FAILED',
      message: error.message,
    });
  }
};

/**
 * 配置平台集成
 */
const configurePlatform = async (req, res) => {
  try {
    const { platform } = req.params;
    const {
      app_id,
      app_secret,
      shop_id,
      shop_name,
      auto_sync_enabled,
      sync_interval_minutes,
    } = req.body;

    // 检查是否已存在配置
    const existing = await query(
      'SELECT id FROM platform_integrations WHERE platform = $1',
      [platform]
    );

    let result;
    if (existing.rows.length > 0) {
      // 更新配置
      result = await query(
        `UPDATE platform_integrations 
         SET app_id = $1, app_secret = $2, shop_id = $3, shop_name = $4,
             auto_sync_enabled = $5, sync_interval_minutes = $6, updated_at = NOW()
         WHERE platform = $7
         RETURNING *`,
        [app_id, app_secret, shop_id, shop_name, auto_sync_enabled, sync_interval_minutes, platform]
      );
    } else {
      // 创建配置
      result = await query(
        `INSERT INTO platform_integrations 
          (platform, app_id, app_secret, shop_id, shop_name, auto_sync_enabled, sync_interval_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [platform, app_id, app_secret, shop_id, shop_name, auto_sync_enabled, sync_interval_minutes]
      );
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Configure platform error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_CONFIGURE_FAILED',
      message: error.message,
    });
  }
};

/**
 * 获取平台配置列表
 */
const getPlatformConfigs = async (req, res) => {
  try {
    const result = await query(
      `SELECT platform, shop_id, shop_name, auto_sync_enabled, 
              sync_interval_minutes, last_sync_at, is_active
       FROM platform_integrations
       ORDER BY platform`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get platform configs error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PLATFORM_CONFIGS_FAILED',
      message: error.message,
    });
  }
};

module.exports = {
  syncProduct,
  syncToAllPlatforms,
  updatePlatformProduct,
  deletePlatformProduct,
  getSyncStatus,
  getPendingSyncProducts,
  triggerAutoSync,
  configurePlatform,
  getPlatformConfigs,
};
