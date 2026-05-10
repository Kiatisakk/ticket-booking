const prisma = require('../config/prisma');

function createRoleRepository(db = prisma) {
  return {
    findByName(roleName) {
      return db.role.findFirst({ where: { RoleName: roleName } });
    }
  };
}

module.exports = createRoleRepository();
module.exports.createRoleRepository = createRoleRepository;
