const { query, isDbConnected } = require('../config/database');
let AlipaySdk, WechatPay;

// 仅在配置了支付密钥时才初始化SDK
let alipaySdk = null;
let wechatPay = null;

try {
  if (process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY) {
    AlipaySdk = require('alipay-sdk').default;
    alipaySdk = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      gateway: 'https://openapi.alipay.com/gateway.do',
    });
    console.log('✅ Alipay SDK initialized');
  } else {
    console.log('⚠️  Alipay not configured (set ALIPAY_APP_ID to enable)');
  }
} catch (error) {
  console.warn('⚠️  Failed to initialize Alipay SDK:', error.message);
}

try {
  if (process.env.WECHAT_PAY_APP_ID && process.env.WECHAT_PAY_MCH_ID) {
    WechatPay = require('wechatpay-node-v3');
    wechatPay = new WechatPay({
      appid: process.env.WECHAT_PAY_APP_ID,
      mchid: process.env.WECHAT_PAY_MCH_ID,
      publicKey: '', // 平台证书
      privateKey: process.env.WECHAT_PAY_API_KEY,
    });
    console.log('✅ WeChat Pay SDK initialized');
  } else {
    console.log('⚠️  WeChat Pay not configured (set WECHAT_PAY_APP_ID to enable)');
  }
} catch (error) {
  console.warn('⚠️  Failed to initialize WeChat Pay SDK:', error.message);
}

/**
 * 创建支付宝支付
 */
const createAlipayOrder = async (orderId, totalAmount, subject, body) => {
  try {
    const result = await alipaySdk.exec(
      'alipay.trade.page.pay',
      {
        bizContent: {
          out_trade_no: orderId,
          total_amount: totalAmount.toFixed(2),
          subject: subject,
          body: body,
          product_code: 'FAST_INSTANT_TRADE_PAY',
        },
      }
    );

    return {
      success: true,
      paymentUrl: result,
      method: 'alipay',
    };
  } catch (error) {
    console.error('Create Alipay order error:', error);
    return {
      success: false,
      message: '创建支付宝订单失败',
    };
  }
};

/**
 * 创建微信支付
 */
const createWechatOrder = async (orderId, totalAmount, description) => {
  try {
    const params = {
      appid: process.env.WECHAT_PAY_APP_ID,
      mchid: process.env.WECHAT_PAY_MCH_ID,
      description: description,
      out_trade_no: orderId,
      notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
      amount: {
        total: Math.round(totalAmount * 100), // 转换为分
        currency: 'CNY',
      },
    };

    const result = await wechatPay.transactions_jsapi(params);

    return {
      success: true,
      data: result,
      method: 'wechat',
    };
  } catch (error) {
    console.error('Create Wechat order error:', error);
    return {
      success: false,
      message: '创建微信订单失败',
    };
  }
};

/**
 * 处理支付宝回调
 */
const handleAlipayNotify = async (notifyData) => {
  try {
    // 验证签名
    const isValid = await alipaySdk.checkNotifySign(notifyData);
    
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    const {
      out_trade_no: orderId,
      trade_status: tradeStatus,
      trade_no: tradeNo,
      total_amount: totalAmount,
    } = notifyData;

    // 更新订单状态
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      await query(
        `UPDATE orders 
         SET payment_status = 'paid', paid_at = NOW(), 
             transaction_id = $1, status = 'confirmed'
         WHERE order_number = $2 AND payment_status = 'pending'`,
        [tradeNo, orderId]
      );

      // 记录支付日志
      await query(
        `INSERT INTO payment_logs (order_id, payment_method, transaction_id, amount, status)
         VALUES ((SELECT id FROM orders WHERE order_number = $1), 'alipay', $2, $3, 'success')`,
        [orderId, tradeNo, totalAmount]
      );
    }

    return 'success';
  } catch (error) {
    console.error('Handle Alipay notify error:', error);
    return 'fail';
  }
};

/**
 * 处理微信支付回调
 */
const handleWechatNotify = async (notifyData) => {
  try {
    const {
      out_trade_no: orderId,
      transaction_id: tradeNo,
      trade_state: tradeState,
      amount,
    } = notifyData;

    if (tradeState === 'SUCCESS') {
      const totalAmount = amount.total / 100; // 转换回元

      await query(
        `UPDATE orders 
         SET payment_status = 'paid', paid_at = NOW(),
             transaction_id = $1, status = 'confirmed'
         WHERE order_number = $2 AND payment_status = 'pending'`,
        [tradeNo, orderId]
      );

      await query(
        `INSERT INTO payment_logs (order_id, payment_method, transaction_id, amount, status)
         VALUES ((SELECT id FROM orders WHERE order_number = $1), 'wechat', $2, $3, 'success')`,
        [orderId, tradeNo, totalAmount]
      );
    }

    return { code: 'SUCCESS', message: '成功' };
  } catch (error) {
    console.error('Handle Wechat notify error:', error);
    return { code: 'FAIL', message: '失败' };
  }
};

/**
 * 查询订单支付状态
 */
const queryPaymentStatus = async (orderId, method) => {
  try {
    if (method === 'alipay') {
      const result = await alipaySdk.exec('alipay.trade.query', {
        bizContent: {
          out_trade_no: orderId,
        },
      });

      return {
        success: true,
        status: result.trade_status,
      };
    } else if (method === 'wechat') {
      const result = await wechatPay.query({
        out_trade_no: orderId,
      });

      return {
        success: true,
        status: result.trade_state,
      };
    }

    return {
      success: false,
      message: '不支持的支付方式',
    };
  } catch (error) {
    console.error('Query payment status error:', error);
    return {
      success: false,
      message: '查询失败',
    };
  }
};

/**
 * 申请退款
 */
const requestRefund = async (orderId, refundAmount, reason) => {
  try {
    const order = await query(
      'SELECT * FROM orders WHERE order_number = $1',
      [orderId]
    );

    if (order.rows.length === 0) {
      throw new Error('订单不存在');
    }

    const orderData = order.rows[0];

    if (orderData.payment_method === 'alipay') {
      const result = await alipaySdk.exec('alipay.trade.refund', {
        bizContent: {
          out_trade_no: orderId,
          refund_amount: refundAmount.toFixed(2),
          refund_reason: reason,
        },
      });

      if (result.code === '10000') {
        await query(
          `UPDATE orders 
           SET payment_status = 'refunded', refund_reason = $1
           WHERE order_number = $2`,
          [reason, orderId]
        );

        return {
          success: true,
          message: '退款成功',
        };
      }
    } else if (orderData.payment_method === 'wechat') {
      const result = await wechatPay.refund({
        out_trade_no: orderId,
        out_refund_no: `REFUND${Date.now()}`,
        amount: {
          refund: Math.round(refundAmount * 100),
          total: Math.round(orderData.total_amount * 100),
          currency: 'CNY',
        },
        reason: reason,
      });

      if (result.status === 'SUCCESS') {
        await query(
          `UPDATE orders 
           SET payment_status = 'refunded', refund_reason = $1
           WHERE order_number = $2`,
          [reason, orderId]
        );

        return {
          success: true,
          message: '退款成功',
        };
      }
    }

    return {
      success: false,
      message: '退款失败',
    };
  } catch (error) {
    console.error('Refund error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

module.exports = {
  createAlipayOrder,
  createWechatOrder,
  handleAlipayNotify,
  handleWechatNotify,
  queryPaymentStatus,
  requestRefund,
};
