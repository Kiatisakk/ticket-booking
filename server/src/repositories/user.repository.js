const prisma = require('../config/prisma');

function createUserRepository(db = prisma) {
  return {
    findByEmail(email, options = {}) {
      return db.user.findFirst({
        where: {
          Email: {
            equals: email,
            mode: 'insensitive'
          }
        },
        ...(options.include ? { include: options.include } : {})
      });
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
