const { query } = require('../config/database');
const paymentService = require('../services/payment.service');

const createAlipayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'PAYMENT_ORDER_NOT_FOUND',
        message: '订单不存在',
      });
    }

    const order = orderResult.rows[0];

    const result = await paymentService.createAlipayOrder(
      order.order_number,
      order.total_amount,
      `手作饰品订单 ${order.order_number}`,
      `订单金额: ¥${order.total_amount}`
    );

    await query(
      'UPDATE orders SET payment_method = $1 WHERE id = $2',
      ['alipay', orderId]
    );

    res.json(result);
  } catch (error) {
    console.error('Create Alipay order error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PAYMENT_ALIPAY_FAILED',
      message: '创建支付订单失败',
    });
  }
};

const createWechatOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'PAYMENT_ORDER_NOT_FOUND',
        message: '订单不存在',
      });
    }

    const order = orderResult.rows[0];

    const result = await paymentService.createWechatOrder(
      order.order_number,
      order.total_amount,
      `手作饰品订单 ${order.order_number}`
    );

    await query(
      'UPDATE orders SET payment_method = $1 WHERE id = $2',
      ['wechat', orderId]
    );

    res.json(result);
  } catch (error) {
    console.error('Create Wechat order error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'PAYMENT_WECHAT_FAILED',
      message: '创建支付订单失败',
    });
  }
};

const handleAlipayNotify = async (req, res) => {
  const result = await paymentService.handleAlipayNotify(req.body);
  res.send(result);
};

const handleWechatNotify = async (req, res) => {
  const result = await paymentService.handleWechatNotify(req.body);
  res.json(result);
};

module.exports = {
  createAlipayOrder,
  createWechatOrder,
  handleAlipayNotify,
  handleWechatNotify,
};
