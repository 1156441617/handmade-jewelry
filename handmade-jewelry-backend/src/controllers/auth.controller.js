const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const RepositoryFactory = require('../repositories/repository.factory');
const { cache } = require('../config/redis');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const Joi = require('joi');

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

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errorCode: 'AUTH_VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    const { email, password, username, phone } = value;
    const userRepo = RepositoryFactory.createUserRepository();

    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        errorCode: 'AUTH_EMAIL_EXISTS',
        message: '该邮箱已被注册',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepo.create({
      email,
      password_hash: passwordHash,
      username,
      phone,
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await userRepo.saveSession({
      user_id: user.id,
      token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });

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
      errorCode: 'AUTH_REGISTER_FAILED',
      message: '注册失败,请稍后重试',
    });
  }
};

const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errorCode: 'AUTH_VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    const { email, password } = value;
    const userRepo = RepositoryFactory.createUserRepository();

    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        message: '邮箱或密码错误',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_ACCOUNT_DISABLED',
        message: '账户已被禁用',
      });
    }

    const validPassword = await userRepo.validatePassword(user, password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        message: '邮箱或密码错误',
      });
    }

    await userRepo.updateLastLogin(user.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await userRepo.saveSession({
      user_id: user.id,
      token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });

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
      errorCode: 'AUTH_LOGIN_FAILED',
      message: '登录失败,请稍后重试',
    });
  }
};

const logout = async (req, res) => {
  try {
    const { token } = req.body;

    if (token) {
      const userRepo = RepositoryFactory.createUserRepository();
      await userRepo.deleteSessionByToken(token);
    }

    res.json({
      success: true,
      message: '登出成功',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'AUTH_LOGOUT_FAILED',
      message: '登出失败',
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRepo = RepositoryFactory.createUserRepository();

    const user = await userRepo.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'AUTH_USER_NOT_FOUND',
        message: '用户不存在',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'AUTH_GET_USER_FAILED',
      message: '获取用户信息失败',
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, gender, birthday, province, city, district, address_detail } = req.body;
    const userRepo = RepositoryFactory.createUserRepository();

    const user = await userRepo.updateProfile(userId, {
      username, gender, birthday, province, city, district, address_detail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'AUTH_USER_NOT_FOUND',
        message: '用户不存在',
      });
    }

    res.json({
      success: true,
      message: '资料更新成功',
      data: user,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'AUTH_UPDATE_FAILED',
      message: '更新失败',
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    const userRepo = RepositoryFactory.createUserRepository();

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        errorCode: 'AUTH_PASSWORD_TOO_SHORT',
        message: '新密码至少8个字符',
      });
    }

    const user = await userRepo.findByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'AUTH_USER_NOT_FOUND',
        message: '用户不存在',
      });
    }

    const validPassword = await userRepo.validatePassword(user, currentPassword);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_PASSWORD_INCORRECT',
        message: '当前密码错误',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(userId, newPasswordHash);

    await userRepo.deleteSessionsByUserId(userId);

    res.json({
      success: true,
      message: '密码修改成功,请重新登录',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'AUTH_CHANGE_PASSWORD_FAILED',
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
