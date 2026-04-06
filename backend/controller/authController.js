const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const User = require('../model/userModel');
const { sendVerificationEmail } = require('../utils/emailService');

// Ensure email_verifications table exists
const initEmailVerificationsTable = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS email_verifications (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            user_name VARCHAR(255) NOT NULL,
            hash_password TEXT NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
};
initEmailVerificationsTable().catch(console.error);

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Username, email, and password are required!" });
        }

        // Block if email already belongs to a verified account
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ message: "Email already in use!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);

        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Upsert into email_verifications (regenerate code if already pending)
        await db.query(`
            INSERT INTO email_verifications (id, email, user_name, hash_password, code, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                user_name = VALUES(user_name),
                hash_password = VALUES(hash_password),
                code = VALUES(code),
                expires_at = VALUES(expires_at),
                created_at = CURRENT_TIMESTAMP
        `, [uuidv4(), email, username, hashPassword, code, expiresAt]);

        // Send OTP via Resend
        await sendVerificationEmail(email, code);

        return res.status(200).json({ message: "Verification code sent to your email!" });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ message: error.message });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ message: "Email and verification code are required!" });
        }

        const [results] = await db.query(
            'SELECT * FROM email_verifications WHERE email = ?',
            [email]
        );
        const record = results[0];

        if (!record) {
            return res.status(400).json({ message: "No pending verification found for this email." });
        }

        if (new Date(record.expires_at) < new Date()) {
            await db.query('DELETE FROM email_verifications WHERE email = ?', [email]);
            return res.status(400).json({ message: "Verification code has expired. Please register again." });
        }

        if (record.code !== code.trim()) {
            return res.status(400).json({ message: "Invalid verification code." });
        }

        // Create the user account
        const userId = uuidv4().trim();
        await User.create(userId, record.user_name, record.email, record.hash_password);

        // Clean up verification record
        await db.query('DELETE FROM email_verifications WHERE email = ?', [email]);

        return res.status(201).json({ message: "Email verified! Your account has been created successfully." });
    } catch (error) {
        console.error('Verify email error:', error);
        return res.status(500).json({ message: error.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required!" })
        }
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(400).json({ message: "Email or password is incorrect!" });
        }
        const isMatch = await bcrypt.compare(password, user.hash_password);
        if (!isMatch) {
            return res.status(400).json({ message: "Email or password is incorrect!" });
        }
        const access_token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, { expiresIn: '15m' });
        const refresh_token = jwt.sign({ id: user.id }, process.env.JWT_TOKEN_SECRET, { expiresIn: '30d' });
        const expireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await db.query('INSERT INTO refresh_tokens (user_id, token, expired_at) VALUES (?, ?, ?)', [user.id, refresh_token, expireAt]);
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        }
        res.cookie('access_token', access_token, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 minutes
        res.cookie('refresh_token', refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
        res.status(200).json({
            message: "Login successfully!",
            user: {
                id: user.id,
                username: user.user_name,
                email: user.email
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const refreshToken = async (req, res) => {
    try {
        const refresh_token = req.cookies.refresh_token;
        if (!refresh_token) {
            return res.status(401).json({ message: "Unauthorized! No refresh token found." });
        }
        
        let decoded;
        try {
            decoded = jwt.verify(refresh_token, process.env.JWT_TOKEN_SECRET);
        } catch (jwtError) {
            return res.status(401).json({ message: "Invalid refresh token!" });
        }

        const [results] = await db.query('SELECT * FROM refresh_tokens WHERE token = ?', [refresh_token]);
        const tokenData = results[0];
        
        if (!tokenData) {
            return res.status(401).json({ message: "Refresh token not found in database!" });
        }

        if (new Date(tokenData.expired_at) < new Date()) {
            await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);
            return res.status(401).json({ message: "Refresh token expired!" });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: "User not found!" });
        }

        const access_token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, { expiresIn: '15m' });
        
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });

        return res.status(200).json({ 
            message: "Token refreshed successfully!",
            success: true 
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(500).json({ message: error.message });
    }
};

const getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log("User ID from token:", userId);
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }
        return res.status(200).json({
            message: "User info retrieved successfully!",
            user: {
                id: userId,
                username: user.user_name,
                email: user.email
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const logout = async (req, res) => {
    try {
        const refresh_token = req.cookies.refresh_token;
        if (!refresh_token) {
            return res.status(401).json({ message: "Unauthorized!" });
        }
        await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return res.status(200).json({ message: "Logout successfully!" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { register, verifyEmail, login, refreshToken, getMe, logout };