const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, transaction, NO_DB_MODE, mockUsers } = require('../config/database');
const { cache } = require('../config/redis');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const Joi = require('joi');

// 注册验证schema
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': '请输入有效的邮箱地址',
    'any.required': '邮箱不能为空',
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': '密码至少6个字符',
    'any.required': '密码不能为空',
  }),
  username: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^1[3-9]\d{9}$/).optional().messages({
    'string.pattern.base': '请输入有效的手机号',
  }),
});

// 登录验证schema
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// NO_DB_MODE下的mock密码(所有mock用户密码都是123456)
const MOCK_PASSWORD_HASH = bcrypt.hashSync('123456', 10);

// 用户注册
const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password, username, phone } = value;

    let user;

    if (NO_DB_MODE) {
      // NO_DB_MODE: 检查邮箱是否已存在
      const existingUser = mockUsers.find(u => u.email === email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: '该邮箱已被注册',
        });
      }

      // 创建mock用户
      user = {
        id: `user-${Date.now()}`,
        email,
        username: username || email.split('@')[0],
        password_hash: bcrypt.hashSync(password, 10),
        avatar_url: null,
        is_active: true,
        role: 'customer',
        membership_level: 'bronze',
        points: 0,
        is_verified: false,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
      mockUsers.push(user);

    } else {
      // 真实数据库模式
      // 检查邮箱是否已存在
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: '该邮箱已被注册',
        });
      }

      // 加密密码
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // 创建用户
      const result = await query(
        `INSERT INTO users (email, password_hash, username, phone) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, email, username, phone, created_at`,
        [email, passwordHash, username || null, phone || null]
      );

      user = result.rows[0];
    }

    // 生成token
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 保存会话
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    if (!NO_DB_MODE) {
      await query(
        `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [user.id, accessToken, refreshToken, expiresAt]
      );
    }

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: '注册失败,请稍后重试',
    });
  }
};

// 用户登录
const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password } = value;

    // 查找用户
    const result = await query(
      `SELECT id, email, password_hash, username, avatar_url, is_active, last_login_at 
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误',
      });
    }

    const user = result.rows[0];

    // 检查账户是否激活
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: '账户已被禁用',
      });
    }

    // 验证密码
    let validPassword = false;
    if (NO_DB_MODE) {
      // NO_DB_MODE: mock用户密码统一为123456
      validPassword = password === '123456' || await bcrypt.compare(password, user.password_hash);
    } else {
      validPassword = await bcrypt.compare(password, user.password_hash);
    }

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误',
      });
    }

    // 更新最后登录时间
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // 生成token
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 保存会话
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
      `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at) 
       VALUES ($1, $2, $3, $4)`,
      [user.id, accessToken, refreshToken, expiresAt]
    );

    // 清除密码字段
    delete user.password_hash;

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录失败,请稍后重试',
    });
  }
};

// 登出
const logout = async (req, res) => {
  try {
    const { token } = req.body;

    if (token) {
      // 从数据库中删除会话
      await query(
        'DELETE FROM user_sessions WHERE token = $1',
        [token]
      );
    }

    res.json({
      success: true,
      message: '登出成功',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: '登出失败',
    });
  }
};

// 获取当前用户信息
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, email, username, avatar_url, gender, birthday, 
              province, city, district, address_detail,
              membership_level, points, is_verified, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
    });
  }
};

// 更新用户资料
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, gender, birthday, province, city, district, address_detail } = req.body;

    const result = await query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           gender = COALESCE($2, gender),
           birthday = COALESCE($3, birthday),
           province = COALESCE($4, province),
           city = COALESCE($5, city),
           district = COALESCE($6, district),
           address_detail = COALESCE($7, address_detail),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, email, username, avatar_url, gender, birthday, 
                 province, city, district, address_detail`,
      [username, gender, birthday, province, city, district, address_detail, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    res.json({
      success: true,
      message: '资料更新成功',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
    });
  }
};

// 修改密码
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // 验证新密码长度
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: '新密码至少8个字符',
      });
    }

    // 获取当前密码哈希
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    // 验证当前密码
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: '当前密码错误',
      });
    }

    // 加密新密码
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // 清除所有会话(强制重新登录)
    await query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: '密码修改成功,请重新登录',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: '修改密码失败',
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
};
