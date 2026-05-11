const prisma = require('../../config/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { findManyHybrid, sortDirection } = require('../../utils/pagination');

function mapPayments(payments) {
  return payments.map(payment => ({
    id: payment.PaymentID,
    bookingId: payment.BookingID,
    transactionId: payment.TransactionID || `TXN-${payment.PaymentID}`,
    amount: Number(payment.Amount),
    method: payment.Method?.MethodName || 'Unknown',
    status: payment.Status?.StatusName || 'Unknown',
    date: payment.PaidAt,
    user: payment.Booking?.User?.FullName || 'Unknown',
    userRole: payment.Booking?.User?.Role?.RoleName || 'Unknown'
  }));
}

exports.getAllTransactions = asyncHandler(async (req, res) => {
  const { search, status, method, sortBy } = req.query;
  const direction = sortDirection(req.query.sortOrder);
  const where = {};

  if (status && status !== 'All') {
    const payStatus = await prisma.paymentStatus.findFirst({
      where: { StatusName: status }
    });
    if (payStatus) where.StatusID = payStatus.StatusID;
  }

  if (method && method !== 'All') {
    const payMethod = await prisma.paymentMethod.findFirst({
      where: { MethodName: { contains: method, mode: 'insensitive' } }
    });
    if (payMethod) where.MethodID = payMethod.MethodID;
  }

  if (search) {
    const searchNum = parseInt(search, 10);
    where.OR = [
      { TransactionID: { contains: search, mode: 'insensitive' } },
      { Booking: { User: { FullName: { contains: search, mode: 'insensitive' } } } },
      { Booking: { User: { Email: { contains: search, mode: 'insensitive' } } } }
    ];
    if (!Number.isNaN(searchNum)) {
      where.OR.push({ BookingID: searchNum });
      where.OR.push({ PaymentID: searchNum });
    }
  }

  const sortMap = {
    bookingId: { BookingID: direction },
    transactionId: { TransactionID: direction },
    amount: { Amount: direction },
    date: { PaidAt: direction },
    status: { Status: { StatusName: direction } },
    method: { Method: { MethodName: direction } },
    user: { Booking: { User: { FullName: direction } } }
  };
  const orderBy = sortMap[sortBy] || { PaidAt: 'desc' };

  const cursorSorts = {
    bookingId: { idField: 'PaymentID', sortField: 'BookingID', valueType: 'number' },
    transactionId: { idField: 'PaymentID', sortField: 'TransactionID', valueType: 'string' },
    amount: { idField: 'PaymentID', sortField: 'Amount', valueType: 'number' },
    date: { idField: 'PaymentID', sortField: 'PaidAt', valueType: 'date' }
  };
  const cursorConfig = cursorSorts[sortBy || 'date']
    ? { ...cursorSorts[sortBy || 'date'], sortOrder: direction }
    : null;

  const payload = await findManyHybrid(prisma.payment, {
    query: req.query,
    where,
    select: {
      PaymentID: true,
      BookingID: true,
      TransactionID: true,
      Amount: true,
      PaidAt: true,
      CreatedAt: true,
      Booking: {
        select: {
          User: { select: { FullName: true, Email: true, Role: { select: { RoleName: true } } } }
        }
      },
      Method: { select: { MethodName: true } },
      Status: { select: { StatusName: true } }
    },
    orderBy,
    cursorConfig,
    map: mapPayments
  });

  res.json(payload);
});
