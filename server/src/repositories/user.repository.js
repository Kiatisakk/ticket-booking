const prisma = require('../config/prisma');

function createUserRepository(db = prisma) {
  return {
    findByEmail(email) {
      return db.user.findFirst({
        where: {
          Email: {
            equals: email,
            mode: 'insensitive'
          }
        }
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
