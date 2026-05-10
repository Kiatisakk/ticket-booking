const prisma = require('../config/prisma');

function createUserRepository(db = prisma) {
  return {
    findByEmail(email) {
      return db.user.findUnique({ where: { Email: email } });
    },

    createCustomer({ fullName, email, hashedPassword, roleId }) {
      return db.user.create({
        data: {
          FullName: fullName,
          Email: email,
          Password: hashedPassword,
          RoleID: roleId
        }
      });
    }
  };
}

module.exports = createUserRepository();
module.exports.createUserRepository = createUserRepository;
