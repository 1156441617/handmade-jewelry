const { NO_DB_MODE } = require('../config/database');
const MockUserRepository = require('./mock-user.repository');
const DatabaseUserRepository = require('./database-user.repository');

class RepositoryFactory {
  static createUserRepository() {
    if (NO_DB_MODE) {
      return new MockUserRepository();
    }
    return new DatabaseUserRepository();
  }
}

module.exports = RepositoryFactory;
