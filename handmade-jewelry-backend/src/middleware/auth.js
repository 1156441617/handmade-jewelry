const jwt = require('jsonwebtoken');
const { query, NO_DB_MODE, mockUsers } = require('../config/database');
require('dotenv').config();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { console.error('FATAL: JWT_SECRET must be set in production'); process.exit(1); })()
    : 'dev-only-secret-key'
);
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { console.error('FATAL: JWT_REFRESH_SECRET must be set in production'); process.exit(1); })()
    : 'dev-only-refresh-secret'
);

// 生成访问令牌
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      role: user.role || 'customer'
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// 生成刷新令牌
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

// 验证访问令牌中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问令牌缺失',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 查找用户
    let user = null;
    
    if (NO_DB_MODE || !(await isDbConnected())) {
      // NO_DB_MODE: 从mock用户中查找
      user = mockUsers.find(u => u.id === decoded.userId && u.is_active);
    } else {
      // 数据库模式
      const userResult = await query(
        'SELECT id, email, username, avatar_url, membership_level FROM users WHERE id = $1 AND is_active = true AND deleted_at IS NULL',
        [decoded.userId]
      );
      if (userResult.rows.length > 0) {
        user = userResult.rows[0];
      }
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        message: '用户不存在或已被禁用',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: '令牌已过期',
      });
    }
    return res.status(403).json({
      success: false,
      message: '无效的令牌',
    });
  }
};

// 检查数据库是否连接
async function isDbConnected() {
  try {
    const { isDbConnected: check } = require('../config/database');
    return check();
  } catch {
    return false;
  }
}

// 可选认证中间件(有token则验证,没有也允许通过)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      let user = null;
      if (NO_DB_MODE || !(await isDbConnected())) {
        user = mockUsers.find(u => u.id === decoded.userId && u.is_active);
      } else {
        const userResult = await query(
          'SELECT id, email, username FROM users WHERE id = $1 AND is_active = true',
          [decoded.userId]
        );
        if (userResult.rows.length > 0) user = userResult.rows[0];
      }
      
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

// 角色授权中间件
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足',
      });
    }

    next();
  };
};

// 刷新令牌
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: '刷新令牌缺失',
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    let user = null;
    
    if (NO_DB_MODE || !(await isDbConnected())) {
      user = mockUsers.find(u => u.id === decoded.userId && u.is_active);
    } else {
      const sessionResult = await query(
        'SELECT user_id FROM user_sessions WHERE refresh_token = $1 AND expires_at > NOW()',
        [refreshToken]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: '无效的刷新令牌',
        });
      }

      const userResult = await query(
        'SELECT id, email, username FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      if (userResult.rows.length > 0) user = userResult.rows[0];
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        message: '用户不存在',
      });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: '无效的刷新令牌',
    });
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  optionalAuth,
  authorize,
  refreshToken,
};
