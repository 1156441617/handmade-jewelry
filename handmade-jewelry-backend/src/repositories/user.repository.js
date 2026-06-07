class UserRepository {
  async findByEmail(email) {
    throw new Error('Method not implemented');
  }

  async findById(id) {
    throw new Error('Method not implemented');
  }

  async create(userData) {
    throw new Error('Method not implemented');
  }

  async updateProfile(userId, profileData) {
    throw new Error('Method not implemented');
  }

  async updatePassword(userId, passwordHash) {
    throw new Error('Method not implemented');
  }

  async updateLastLogin(userId) {
    throw new Error('Method not implemented');
  }

  async validatePassword(user, password) {
    throw new Error('Method not implemented');
  }

  async saveSession(sessionData) {
    throw new Error('Method not implemented');
  }

  async deleteSessionByToken(token) {
    throw new Error('Method not implemented');
  }

  async deleteSessionsByUserId(userId) {
    throw new Error('Method not implemented');
  }
}

module.exports = UserRepository;
