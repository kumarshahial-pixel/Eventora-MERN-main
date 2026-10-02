const express = require('express');
const router = express.Router();
const { register, login, googleLogin, verifyOTP, forgotPassword, verifyResetOTP, resetPassword, changePassword, deleteAccount } = require('../controllers/authController');
const uploadProfileImage = require('../middleware/uploadProfileImage');
const { protect } = require('../middleware/auth');

router.post('/register', uploadProfileImage, register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/verify-otp', verifyOTP);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);
router.patch('/change-password', protect, changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;
