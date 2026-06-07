const { query, transaction } = require('../config/database');
const { cache } = require('../config/redis');
const Joi = require('joi');

// 商品列表查询参数验证
const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  sort: Joi.string().valid('newest', 'price_asc', 'price_desc', 'popular', 'rating').default('newest'),
  tag: Joi.string().optional(),
  search: Joi.string().optional(),
});

// 获取商品列表
const getProducts = async (req, res) => {
  try {
    // 验证查询参数
    const { error, value } = listQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        errorCode: 'PRODUCT_VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    const { page, pageSize, category, minPrice, maxPrice, sort, tag, search } = value;
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereConditions = ['status = $1', 'deleted_at IS NULL'];
    let queryParams = ['active'];
    let paramIndex = 2;

    if (category) {
      whereConditions.push(`category_id IN (SELECT id FROM categories WHERE slug = $${paramIndex})`);
      queryParams.push(category);
      paramIndex++;
    }

    if (minPrice !== undefined) {
      whereConditions.push(`price >= $${paramIndex}`);
      queryParams.push(minPrice);
      paramIndex++;
    }

    if (maxPrice !== undefined) {
      whereConditions.push(`price <= $${paramIndex}`);
      queryParams.push(maxPrice);
      paramIndex++;
    }

    if (tag) {
      whereConditions.push(`tags @> ARRAY[$${paramIndex}]::TEXT[]`);
      queryParams.push(tag);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // 排序
    let orderBy = 'created_at DESC';
    switch (sort) {
      case 'price_asc':
        orderBy = 'price ASC';
        break;
      case 'price_desc':
        orderBy = 'price DESC';
        break;
      case 'popular':
        orderBy = 'sales_count DESC';
        break;
      case 'rating':
        orderBy = 'rating_average DESC';
        break;
      default:
        orderBy = 'created_at DESC';
    }

    // 检查缓存
    const cacheKey = `products:${JSON.stringify(value, Object.keys(value).sort())}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 查询总数
    const countResult = await query(
      `SELECT COUNT(*) FROM products WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // 查询商品列表
    const result = await query(
      `SELECT 
        p.id, p.sku, p.name, p.slug, p.description, p.price, p.original_price,
        p.main_image_url, p.image_urls, p.rating_average, p.review_count,
        p.sales_count, p.is_featured, p.is_new_arrival, p.is_limited_edition,
        p.tags, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, pageSize, offset]
    );

    const products = result.rows;

    // 构造响应
    const response = {
      success: true,
      data: {
        products,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };

    // 缓存结果(5分钟)
    await cache.set(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_LIST_FAILED',
      message: '获取商品列表失败',
    });
  }
};

// 获取商品详情
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查缓存
    const cacheKey = `product:${id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      // 增加浏览量
      await query('UPDATE products SET view_count = view_count + 1 WHERE id = $1', [id]);
      return res.json(cached);
    }

    // 查询商品详情
    const result = await query(
      `SELECT 
        p.*, 
        c.name as category_name, c.slug as category_slug,
        u.username as creator_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'PRODUCT_NOT_FOUND',
        message: '商品不存在',
      });
    }

    const product = result.rows[0];

    // 查询商品规格
    const variantsResult = await query(
      'SELECT * FROM product_variants WHERE product_id = $1 AND is_active = true ORDER BY created_at',
      [id]
    );

    product.variants = variantsResult.rows;

    // 查询相关推荐商品
    const relatedResult = await query(
      `SELECT id, name, slug, price, main_image_url, rating_average
       FROM products
       WHERE category_id = $1 AND id != $2 AND status = 'active' AND deleted_at IS NULL
       ORDER BY rating_average DESC
       LIMIT 4`,
      [product.category_id, id]
    );

    product.related_products = relatedResult.rows;

    // 增加浏览量
    await query('UPDATE products SET view_count = view_count + 1 WHERE id = $1', [id]);

    // 构造响应
    const response = {
      success: true,
      data: product,
    };

    // 缓存结果(10分钟)
    await cache.set(cacheKey, response, 600);

    res.json(response);
  } catch (error) {
    console.error('Get product detail error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_DETAIL_FAILED',
      message: '获取商品详情失败',
    });
  }
};

// 创建商品(管理员)
const createProduct = async (req, res) => {
  try {
    const {
      sku, name, slug, description, detail_html, category_id, brand,
      price, original_price, cost_price, stock_quantity, material, color, size,
      weight_grams, dimensions, main_image_url, image_urls, video_url,
      meta_title, meta_description, meta_keywords, tags, features
    } = req.body;

    // 验证必填字段
    if (!sku || !name || !category_id || !price || !main_image_url) {
      return res.status(400).json({
        success: false,
        errorCode: 'PRODUCT_MISSING_FIELDS',
        message: '缺少必填字段',
      });
    }

    // 检查SKU是否已存在
    const existingSku = await query(
      'SELECT id FROM products WHERE sku = $1 AND deleted_at IS NULL',
      [sku]
    );

    if (existingSku.rows.length > 0) {
      return res.status(409).json({
        success: false,
        errorCode: 'PRODUCT_SKU_EXISTS',
        message: 'SKU已存在',
      });
    }

    // 生成slug(如果未提供)
    const productSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // 插入商品
    const result = await query(
      `INSERT INTO products (
        sku, name, slug, description, detail_html, category_id, brand,
        price, original_price, cost_price, stock_quantity, material, color, size,
        weight_grams, dimensions, main_image_url, image_urls, video_url,
        meta_title, meta_description, meta_keywords, tags, features,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *`,
      [
        sku, name, productSlug, description, detail_html, category_id, brand,
        price, original_price, cost_price, stock_quantity || 0, material, color, size,
        weight_grams, dimensions, main_image_url, image_urls || [], video_url,
        meta_title, meta_description, meta_keywords || [], tags || [], features,
        'active', req.user.id
      ]
    );

    // 清除商品列表缓存
    await cache.delPattern('products:*');

    res.status(201).json({
      success: true,
      message: '商品创建成功',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_CREATE_FAILED',
      message: '创建商品失败',
    });
  }
};

// 更新商品(管理员)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 检查商品是否存在
    const existing = await query(
      'SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'PRODUCT_NOT_FOUND',
        message: '商品不存在',
      });
    }

    // 构建更新语句
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      'name', 'slug', 'description', 'detail_html', 'category_id', 'brand',
      'price', 'original_price', 'cost_price', 'stock_quantity', 'material',
      'color', 'size', 'weight_grams', 'dimensions', 'main_image_url',
      'image_urls', 'video_url', 'meta_title', 'meta_description',
      'meta_keywords', 'tags', 'features', 'status', 'is_featured',
      'is_new_arrival', 'is_limited_edition'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(updates[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'PRODUCT_NO_UPDATE_FIELDS',
        message: '没有要更新的字段',
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const result = await query(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );

    // 清除缓存
    await cache.del(`product:${id}`);
    await cache.delPattern('products:*');

    res.json({
      success: true,
      message: '商品更新成功',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_UPDATE_FAILED',
      message: '更新商品失败',
    });
  }
};

// 删除商品(软删除)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE products 
       SET deleted_at = NOW(), status = 'inactive' 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'PRODUCT_NOT_FOUND',
        message: '商品不存在',
      });
    }

    // 清除缓存
    await cache.del(`product:${id}`);
    await cache.delPattern('products:*');

    res.json({
      success: true,
      message: '商品已删除',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_DELETE_FAILED',
      message: '删除商品失败',
    });
  }
};

// 获取分类列表
const getCategories = async (req, res) => {
  try {
    // 检查缓存
    const cacheKey = 'categories:all';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await query(
      `SELECT id, name, slug, description, parent_id, icon_url, sort_order
       FROM categories
       WHERE is_active = true
       ORDER BY sort_order ASC, name ASC`
    );

    const response = {
      success: true,
      data: result.rows,
    };

    // 缓存1小时
    await cache.set(cacheKey, response, 3600);

    res.json(response);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_CATEGORIES_FAILED',
      message: '获取分类失败',
    });
  }
};

// 添加商品到收藏
const addToFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // 检查商品是否存在
    const product = await query(
      'SELECT id FROM products WHERE id = $1 AND status = $2',
      [productId, 'active']
    );

    if (product.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'PRODUCT_NOT_FOUND',
        message: '商品不存在或已下架',
      });
    }

    // 添加收藏
    await query(
      `INSERT INTO product_favorites (user_id, product_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, productId]
    );

    // 更新商品收藏数
    await query(
      'UPDATE products SET favorite_count = favorite_count + 1 WHERE id = $1',
      [productId]
    );

    res.json({
      success: true,
      message: '已添加到收藏',
    });
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_FAVORITE_ADD_FAILED',
      message: '收藏失败',
    });
  }
};

// 取消收藏
const removeFromFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const result = await query(
      'DELETE FROM product_favorites WHERE user_id = $1 AND product_id = $2 RETURNING id',
      [userId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'PRODUCT_FAVORITE_NOT_FOUND',
        message: '收藏不存在',
      });
    }

    // 更新商品收藏数
    await query(
      'UPDATE products SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = $1',
      [productId]
    );

    res.json({
      success: true,
      message: '已取消收藏',
    });
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_FAVORITE_REMOVE_FAILED',
      message: '操作失败',
    });
  }
};

// 获取用户收藏列表
const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const result = await query(
      `SELECT p.id, p.name, p.slug, p.price, p.main_image_url, p.rating_average,
              pf.created_at as favorited_at
       FROM product_favorites pf
       JOIN products p ON pf.product_id = p.id
       WHERE pf.user_id = $1 AND p.deleted_at IS NULL
       ORDER BY pf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM product_favorites WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        favorites: result.rows,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_FAVORITES_LIST_FAILED',
      message: '获取收藏列表失败',
    });
  }
};

// 卖家中心发布商品(免认证，自动转换数据格式)
const createProductFromSeller = async (req, res) => {
  try {
    const productData = req.body;

    // 将卖家中心的数据格式转换为后端期望的格式
    const categorySlugToId = {
      'rings': '1',
      'earrings': '2',
      'necklaces': '3',
      'bracelets': '4',
      'gift-sets': '5',
    };

    const sku = productData.sku || `SKU-${Date.now()}`;
    const name = productData.name;
    const category_id = categorySlugToId[productData.category] || productData.category || '1';
    const price = parseFloat(productData.price) || 0;
    const main_image_url = productData.image || (productData.images && productData.images[0]) || '';
    const original_price = productData.originalPrice ? parseFloat(productData.originalPrice) : null;
    const description = productData.description || '';
    const stock_quantity = parseInt(productData.stock) || 0;
    const material = productData.material || '';
    const image_urls = productData.images || [];
    const tags = productData.tags || [];

    // 验证必填字段
    if (!name || !price) {
      return res.status(400).json({
        success: false,
        errorCode: 'PRODUCT_MISSING_FIELDS',
        message: '缺少必填字段(名称、价格)',
      });
    }

    // 检查SKU是否已存在
    const existingSku = await query(
      'SELECT id FROM products WHERE sku = $1 AND deleted_at IS NULL',
      [sku]
    );

    if (existingSku.rows.length > 0) {
      // SKU已存在，生成新的
      const newSku = `${sku}-${Date.now()}`;
      return await insertSellerProduct(newSku, name, category_id, price, original_price, description, stock_quantity, material, main_image_url, image_urls, tags, res);
    }

    return await insertSellerProduct(sku, name, category_id, price, original_price, description, stock_quantity, material, main_image_url, image_urls, tags, res);
  } catch (error) {
    console.error('Create product from seller error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PRODUCT_CREATE_FAILED',
      message: '创建商品失败',
    });
  }
};

async function insertSellerProduct(sku, name, category_id, price, original_price, description, stock_quantity, material, main_image_url, image_urls, tags, res) {
  const productSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const result = await query(
    `INSERT INTO products (
      sku, name, slug, description, category_id,
      price, original_price, stock_quantity, material,
      main_image_url, image_urls, tags,
      status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      sku, name, productSlug, description, category_id,
      price, original_price, stock_quantity, material,
      main_image_url, image_urls, tags,
      'active', 'seller-center'
    ]
  );

  // 清除商品列表缓存
  await cache.delPattern('products:*');

  res.status(201).json({
    success: true,
    message: '商品发布成功',
    data: result.rows[0],
  });
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  createProductFromSeller,
  updateProduct,
  deleteProduct,
  getCategories,
  addToFavorites,
  removeFromFavorites,
  getFavorites,
};
