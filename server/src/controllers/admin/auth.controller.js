const authService = require('../../services/auth.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.adminLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithRole({
    ...req.body,
    allowedRoleNames: ['Admin'],
    forbiddenMessage: 'Admin access required',
    successMessage: 'Admin login successful'
  });
  res.json(result);
});

exports.staffLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithRole({
    ...req.body,
    allowedRoleNames: ['Staff'],
    forbiddenMessage: 'Staff access required',
    successMessage: 'Staff login successful'
  });
  res.json(result);
});
