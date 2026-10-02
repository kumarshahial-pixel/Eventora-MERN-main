const multer = require('multer');

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const parseProfileImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!allowedImageTypes.has(file.mimetype)) {
            return callback(new Error('Please upload a JPEG, PNG, GIF, or WebP image'));
        }
        callback(null, true);
    }
}).single('profileImage');

module.exports = (req, res, next) => {
    parseProfileImage(req, res, (error) => {
        if (!error) return next();

        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Profile image must be 5 MB or smaller'
            : error.message;
        res.status(400).json({ message });
    });
};