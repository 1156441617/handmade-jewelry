const bcrypt = require('bcryptjs');
const UserRepository = require('./user.repository');
const { mockUsers, mockSessions } = require('../config/database');

const MOCK_PASSWORD_HASH = bcrypt.hashSync('123456', 10);
const VALID_BCRYPT_REGEX = /^\$2[aby]?\$\d{2}\$.{53}$/;

class MockUserRepository extends UserRepository {
  async findByEmail(email) {
    return mockUsers.find(u => u.email === email) || null;
  }

  async findById(id) {
    return mockUsers.find(u => u.id === id) || null;
  }

  async create(userData) {
    const user = {
      id: `user-${Date.now()}`,
      email: userData.email,
      username: userData.username || userData.email.split('@')[0],
      password_hash: userData.password_hash,
      phone: userData.phone || null,
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
    return user;
  }

  async updateProfile(userId, profileData) {
    const user = mockUsers.find(u => u.id === userId);
    if (!user) return null;

    const fields = ['username', 'gender', 'birthday', 'province', 'city', 'district', 'address_detail'];
    fields.forEach(field => {
      if (profileData[field] !== undefined) {
        user[field] = profileData[field];
      }
    });

    return user;
  }

  async updatePassword(userId, passwordHash) {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      user.password_hash = passwordHash;
    }
  }

  async updateLastLogin(userId) {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      user.last_login_at = new Date().toISOString();
    }
  }

  async validatePassword(user, password) {
    const passwordHash = VALID_BCRYPT_REGEX.test(user.password_hash)
      ? user.password_hash
      : MOCK_PASSWORD_HASH;
    return await bcrypt.compare(password, passwordHash);
  }

  async saveSession(sessionData) {
    mockSessions.push({
      user_id: sessionData.user_id,
      token: sessionData.token,
      refresh_token: sessionData.refresh_token,
      expires_at: sessionData.expires_at,
    });
  }

  async deleteSessionByToken(token) {
    const index = mockSessions.findIndex(s => s.token === token);
    if (index !== -1) {
      mockSessions.splice(index, 1);
    }
  }

  async deleteSessionsByUserId(userId) {
    const toRemove = mockSessions.filter(s => s.user_id === userId);
    toRemove.forEach(s => {
      const index = mockSessions.indexOf(s);
      if (index !== -1) {
        mockSessions.splice(index, 1);
      }
    });
  }
}

module.exports = MockUserRepository;
