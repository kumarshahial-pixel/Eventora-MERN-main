const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { sendOTPEmail } = require('../utils/email');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const profileImageExtensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const isStrongPassword = (password) => {
    if (typeof password !== 'string') return false;
    return /^(?=(?:.*[A-Za-z]){2})(?=(?:.*\d){2})(?=.*[@#$]).{6,}$/.test(password);
};

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
    let user;
    let uploadedProfileImagePath;
    try {
        const { name, email, phone, password, confirmPassword, role } = req.body;
        const cleanName = String(name || '').trim();
        const cleanEmail = String(email || '').trim().toLowerCase();
        const enteredPhone = String(phone || '').trim();

        if (!cleanName || !cleanEmail || !enteredPhone || !password || !confirmPassword) {
            return res.status(400).json({ message: 'Name, email, phone, password and confirm password are required' });
        }

        const parsedPhone = parsePhoneNumberFromString(enteredPhone);
        if (!parsedPhone || !parsedPhone.isValid()) {
            return res.status(400).json({ message: 'Please enter a valid mobile number with its country code' });
        }
        const cleanPhone = parsedPhone.number;

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters and include at least 2 letters, 2 numbers, and one special character (@, #, or $)'
            });
        }

        user = await User.findOne({ email: cleanEmail });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let profileImage = '';
        if (req.file) {
            const extension = profileImageExtensions[req.file.mimetype];
            if (!extension) {
                return res.status(400).json({ message: 'Please upload a JPEG, PNG, GIF, or WebP image' });
            }

            const uploadDirectory = path.join(__dirname, '..', 'uploads', 'profiles');
            const fileName = `${crypto.randomUUID()}${extension}`;
            uploadedProfileImagePath = path.join(uploadDirectory, fileName);
            await fs.mkdir(uploadDirectory, { recursive: true });
            await fs.writeFile(uploadedProfileImagePath, req.file.buffer);
            profileImage = `/uploads/profiles/${fileName}`;
        }

        user = await User.create({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            profileImage,
            password: hashedPassword,
            role: 'user', // Hardcoded to prevent frontend passing role
            isVerified: false
        });

        const otp = generateOTP();
        await OTP.create({ email: cleanEmail, otp, action: 'account_verification' });
        try {
            await sendOTPEmail(cleanEmail, otp, 'account_verification');
        } catch (emailError) {
            await OTP.deleteOne({ email: cleanEmail, otp, action: 'account_verification' });
            return res.status(500).json({
                message: 'Failed to send verification email. Please check Gmail SMTP credentials in server/.env.'
            });
        }

        res.status(201).json({
            message: 'OTP sent to email. Please verify.',
            email: user.email,
            profileImage: user.profileImage
        });
    } catch (error) {
        if (uploadedProfileImagePath && !user) {
            await fs.unlink(uploadedProfileImagePath).catch(() => {});
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = String(email || '').trim().toLowerCase();
        const user = await User.findOne({ email: cleanEmail });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        if (!user.isVerified && user.role !== 'admin') {
            const otp = generateOTP();
            await OTP.findOneAndDelete({ email: user.email, action: 'account_verification' });
            await OTP.create({ email: user.email, otp, action: 'account_verification' });
            await sendOTPEmail(user.email, otp, 'account_verification');
            return res.status(403).json({ message: 'Account not verified', needsVerification: true, email: user.email });
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            profileImage: user.profileImage,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential || !process.env.GOOGLE_CLIENT_ID) {
            return res.status(400).json({ message: 'Google login is not configured' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const email = String(payload.email || '').trim().toLowerCase();
        if (!email || !payload.email_verified) {
            return res.status(400).json({ message: 'Google account email is not verified' });
        }

        let user = await User.findOne({ email });
        if (!user) {
            const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            user = await User.create({
                name: payload.name || payload.given_name || 'Eventora User',
                email,
                password: randomPassword,
                role: 'user',
                isVerified: true
            });
        } else if (!user.isVerified) {
            user.isVerified = true;
            await user.save();
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            profileImage: user.profileImage,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        res.status(401).json({ message: 'Google login failed. Please try again.' });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = String(email || '').trim().toLowerCase();
        const validOTP = await OTP.findOne({ email: cleanEmail, otp, action: 'account_verification' });

        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await User.findOneAndUpdate({ email: cleanEmail }, { isVerified: true }, { new: true });
        await OTP.deleteOne({ _id: validOTP._id }); // Delete OTP after usage

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            profileImage: user.profileImage,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = String(email || '').trim().toLowerCase();

        if (!cleanEmail) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        const otp = generateOTP();
        await OTP.findOneAndDelete({ email: cleanEmail, action: 'password_reset' });
        await OTP.create({ email: cleanEmail, otp, action: 'password_reset' });

        try {
            await sendOTPEmail(cleanEmail, otp, 'password_reset');
        } catch (emailError) {
            await OTP.deleteOne({ email: cleanEmail, otp, action: 'password_reset' });
            return res.status(500).json({
                message: 'Failed to send reset OTP. Please check Gmail SMTP credentials in server/.env.'
            });
        }

        res.json({
            message: 'Password reset OTP sent to your email.',
            email: cleanEmail
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = String(email || '').trim().toLowerCase();

        if (!cleanEmail || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const validOTP = await OTP.findOne({ email: cleanEmail, otp, action: 'password_reset' });
        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        res.json({
            message: 'OTP verified successfully. Please enter a new password.',
            email: cleanEmail
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, password, confirmPassword } = req.body;
        const cleanEmail = String(email || '').trim().toLowerCase();

        if (!cleanEmail || !otp || !password || !confirmPassword) {
            return res.status(400).json({ message: 'Email, OTP, password and confirm password are required' });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters and include at least 2 letters, 2 numbers, and one special character (@, #, or $)'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        const validOTP = await OTP.findOne({ email: cleanEmail, otp, action: 'password_reset' });
        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.isVerified = true;
        await user.save();
        await OTP.deleteOne({ _id: validOTP._id });

        res.json({
            message: 'Password reset successfully. Please log in with your new password.'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'Current password, new password, and confirmation are required' });
        }
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters and include at least 2 letters, 2 numbers, and one special character (@, #, or $)'
            });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }

        const user = await User.findById(req.user._id);
        if (!user || user.isDeleted) {
            return res.status(404).json({ message: 'Account not found' });
        }
        if (!await bcrypt.compare(currentPassword, user.password)) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        if (await bcrypt.compare(newPassword, user.password)) {
            return res.status(400).json({ message: 'New password must be different from your current password' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ message: 'Enter your password to delete your account' });
        }

        const user = await User.findById(req.user._id);
        if (!user || user.isDeleted) {
            return res.status(404).json({ message: 'Account not found' });
        }
        if (user.role === 'admin') {
            return res.status(403).json({ message: 'Administrator accounts cannot be deleted here' });
        }
        if (!await bcrypt.compare(password, user.password)) {
            return res.status(400).json({ message: 'Password is incorrect' });
        }

        const profileImagePath = user.profileImage;
        user.name = 'Deleted user';
        user.email = `deleted-${user._id}@deleted.local`;
        user.phone = '';
        user.profileImage = '';
        user.password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        user.isVerified = false;
        user.isDeleted = true;
        user.deletedAt = new Date();
        await user.save();

        if (profileImagePath?.startsWith('/uploads/profiles/')) {
            const filePath = path.resolve(__dirname, '..', profileImagePath.slice(1));
            const profileDirectory = path.resolve(__dirname, '..', 'uploads', 'profiles');
            if (filePath.startsWith(`${profileDirectory}${path.sep}`)) {
                await fs.unlink(filePath).catch(() => {});
            }
        }

        res.json({ message: 'Account deleted. Your event booking records have been retained without your personal details.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
