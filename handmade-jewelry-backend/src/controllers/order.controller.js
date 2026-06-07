const { query, transaction } = require('../config/database');
const { cache } = require('../config/redis');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

// 创建订单验证
const createOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.string().uuid().required(),
      variant_id: Joi.string().uuid().optional(),
      quantity: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
  
  shipping_name: Joi.string().max(100).required(),
  shipping_phone: Joi.string().pattern(/^1[3-9]\d{9}$/).required(),
  shipping_province: Joi.string().required(),
  shipping_city: Joi.string().required(),
  shipping_district: Joi.string().required(),
  shipping_address: Joi.string().required(),
  
  coupon_code: Joi.string().optional(),
  customer_note: Joi.string().max(500).optional(),
});

// 创建订单
const createOrder = async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    // 验证输入
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errorCode: 'ORDER_VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    const userId = req.user.id;
    const { items, shipping_name, shipping_phone, shipping_province, 
            shipping_city, shipping_district, shipping_address, 
            coupon_code, customer_note } = value;

    await client.query('BEGIN');

    // 生成订单号
    const orderNumber = await generateOrderNumber(client);

    let subtotal = 0;
    const orderItems = [];

    // 验证商品并计算总价
    for (const item of items) {
      // 查询商品信息
      const productResult = await client.query(
        'SELECT * FROM products WHERE id = $1 AND status = $2',
        [item.product_id, 'active']
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          errorCode: 'ORDER_PRODUCT_NOT_FOUND',
          message: `商品 ${item.product_id} 不存在或已下架`,
        });
      }

      const product = productResult.rows[0];

      // 检查库存
      if (product.stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          errorCode: 'ORDER_OUT_OF_STOCK',
          message: `商品 "${product.name}" 库存不足`,
        });
      }

      // 如果指定了规格,验证规格
      let unitPrice = product.price;
      if (item.variant_id) {
        const variantResult = await client.query(
          'SELECT * FROM product_variants WHERE id = $1 AND product_id = $2 AND is_active = true',
          [item.variant_id, item.product_id]
        );

        if (variantResult.rows.length > 0) {
          const variant = variantResult.rows[0];
          if (variant.stock_quantity < item.quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              errorCode: 'ORDER_VARIANT_OUT_OF_STOCK',
              message: `规格库存不足`,
            });
          }
          unitPrice = variant.price || product.price;
        }
      }

      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: product.name,
        product_sku: product.sku,
        product_image: product.main_image_url,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
      });
    }

    // 计算运费(满99包邮)
    const shippingFee = subtotal >= 99 ? 0 : 10;

    // 应用优惠券
    let discountAmount = 0;
    let appliedCoupon = null;

    if (coupon_code) {
      const couponResult = await client.query(
        `SELECT c.*, uc.id as user_coupon_id
         FROM coupons c
         JOIN user_coupons uc ON c.id = uc.coupon_id
         WHERE uc.user_id = $1 AND uc.status = 'available' AND c.code = $2
         AND c.valid_from <= NOW() AND c.valid_until >= NOW()`,
        [userId, coupon_code]
      );

      if (couponResult.rows.length > 0) {
        const coupon = couponResult.rows[0];

        // 检查最低消费金额
        if (subtotal >= coupon.min_order_amount) {
          if (coupon.discount_type === 'percentage') {
            discountAmount = subtotal * (coupon.discount_value / 100);
            if (coupon.max_discount_amount) {
              discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
            }
          } else if (coupon.discount_type === 'fixed') {
            discountAmount = coupon.discount_value;
          }

          appliedCoupon = coupon;
        }
      }
    }

    const totalAmount = subtotal + shippingFee - discountAmount;

    // 创建订单
    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, user_id, 
        shipping_name, shipping_phone, shipping_province, shipping_city, 
        shipping_district, shipping_address,
        subtotal, shipping_fee, discount_amount, total_amount,
        coupon_id, coupon_code, customer_note, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        orderNumber, userId,
        shipping_name, shipping_phone, shipping_province, shipping_city,
        shipping_district, shipping_address,
        subtotal, shippingFee, discountAmount, totalAmount,
        appliedCoupon?.id, coupon_code, customer_note, 'pending'
      ]
    );

    const order = orderResult.rows[0];

    // 创建订单商品
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, variant_id, product_name, product_sku,
          product_image, quantity, unit_price, subtotal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          order.id, item.product_id, item.variant_id, item.product_name,
          item.product_sku, item.product_image, item.quantity,
          item.unit_price, item.subtotal
        ]
      );

      // 扣减库存
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );

      // 如果使用了规格,扣减规格库存
      if (item.variant_id) {
        await client.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [item.quantity, item.variant_id]
        );
      }
    }

    // 使用优惠券
    if (appliedCoupon) {
      await client.query(
        `UPDATE user_coupons 
         SET status = 'used', used_at = NOW(), order_id = $1 
         WHERE id = $2`,
        [order.id, appliedCoupon.user_coupon_id]
      );

      await client.query(
        'UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1',
        [appliedCoupon.id]
      );
    }

    // 清空购物车中已购买的商品
    await client.query(
      `DELETE FROM cart_items 
       WHERE user_id = $1 AND (product_id, variant_id) IN (
         SELECT product_id, variant_id FROM order_items WHERE order_id = $2
       )`,
      [userId, order.id]
    );

    await client.query('COMMIT');

    // 清除缓存
    await cache.delPattern('products:*');

    res.status(201).json({
      success: true,
      message: '订单创建成功',
      data: {
        order: {
          ...order,
          items: orderItems,
        },
      },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'ORDER_CREATE_FAILED',
      message: '创建订单失败',
    });
  } finally {
    client.release();
  }
};

// 生成订单号辅助函数
async function generateOrderNumber(client) {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  const result = await client.query(
    `SELECT MAX(CAST(SUBSTRING(order_number FROM 11) AS INTEGER)) as max_num
     FROM orders
     WHERE order_number LIKE $1`,
    [`ORD${datePrefix}%`]
  );

  const nextNum = (result.rows[0].max_num || 0) + 1;
  return `ORD${datePrefix}${String(nextNum).padStart(6, '0')}`;
}

// 获取用户订单列表
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'user_id = $1';
    const queryParams = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // 查询总数
    const countResult = await query(
      `SELECT COUNT(*) FROM orders WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // 查询订单列表
    const result = await query(
      `SELECT * FROM orders 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, pageSize, offset]
    );

    // 批量查询所有订单的商品
    const orderIds = result.rows.map(o => o.id);
    let itemsByOrder = {};

    if (orderIds.length > 0) {
      const itemsResult = await query(
        'SELECT * FROM order_items WHERE order_id = ANY($1)',
        [orderIds]
      );
      itemsByOrder = itemsResult.rows.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {});
    }

    const orders = result.rows.map(order => ({
      ...order,
      items: itemsByOrder[order.id] || [],
    }));

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'ORDER_LIST_FAILED',
      message: '获取订单列表失败',
    });
  }
};

// 获取订单详情
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'ORDER_NOT_FOUND',
        message: '订单不存在',
      });
    }

    const order = result.rows[0];

    // 查询订单商品
    const itemsResult = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get order detail error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'ORDER_DETAIL_FAILED',
      message: '获取订单详情失败',
    });
  }
};

// 取消订单
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const order = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'ORDER_NOT_FOUND',
        message: '订单不存在',
      });
    }

    const orderData = order.rows[0];

    if (orderData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        errorCode: 'ORDER_CANNOT_CANCEL',
        message: '该订单状态不允许取消',
      });
    }

    await transaction(async (client) => {
      // 更新订单状态
      await client.query(
        `UPDATE orders 
         SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1
         WHERE id = $2`,
        [reason, id]
      );

      // 恢复库存
      const items = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [id]
      );

      for (const item of items.rows) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );

        if (item.variant_id) {
          await client.query(
            'UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [item.quantity, item.variant_id]
          );
        }
      }

      // 返还优惠券
      if (orderData.coupon_id) {
        await client.query(
          `UPDATE user_coupons 
           SET status = 'available', used_at = NULL, order_id = NULL 
           WHERE order_id = $1`,
          [id]
        );
      }
    });

    res.json({
      success: true,
      message: '订单已取消',
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'ORDER_CANCEL_FAILED',
      message: '取消订单失败',
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
};
