const bcrypt = require('bcryptjs');
const UserRepository = require('./user.repository');
const { query } = require('../config/database');

class DatabaseUserRepository extends UserRepository {
  async findByEmail(email) {
    const result = await query(
      `SELECT id, email, password_hash, username, avatar_url, is_active, last_login_at 
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    return result.rows[0] || null;
  }

  async findById(id) {
    const result = await query(
      `SELECT id, email, username, avatar_url, gender, birthday, 
              province, city, district, address_detail,
              membership_level, points, is_verified, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(userData) {
    const result = await query(
      `INSERT INTO users (email, password_hash, username, phone) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, username, phone, created_at`,
      [userData.email, userData.password_hash, userData.username || null, userData.phone || null]
    );
    return result.rows[0];
  }

  async updateProfile(userId, profileData) {
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
      [
        profileData.username, profileData.gender, profileData.birthday,
        profileData.province, profileData.city, profileData.district,
        profileData.address_detail, userId
      ]
    );
    return result.rows[0] || null;
  }

  async updatePassword(userId, passwordHash) {
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
  }

  async updateLastLogin(userId) {
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  async validatePassword(user, password) {
    return await bcrypt.compare(password, user.password_hash);
  }

  async saveSession(sessionData) {
    await query(
      `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at) 
       VALUES ($1, $2, $3, $4)`,
      [sessionData.user_id, sessionData.token, sessionData.refresh_token, sessionData.expires_at]
    );
  }

  async deleteSessionByToken(token) {
    await query(
      'DELETE FROM user_sessions WHERE token = $1',
      [token]
    );
  }

  async deleteSessionsByUserId(userId) {
    await query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );
  }
}

module.exports = DatabaseUserRepository;
