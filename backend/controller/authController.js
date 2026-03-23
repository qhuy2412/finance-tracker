const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const User = require('../model/userModel');

const register = async (req, res) => {
    try {
        const { username, email, password} = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Username, email, and password are required!" })
        }
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ message: "Email already use!" });
        }
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);
        const userId = uuidv4().trim();
        await User.create(userId, username, email, hashPassword);
        return res.status(201).json({ message: "Register successfully!" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
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
        res.status(200).json({ message: "Login successfully!",
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
        
        // Verify refresh token signature first
        let decoded;
        try {
            decoded = jwt.verify(refresh_token, process.env.JWT_TOKEN_SECRET);
        } catch (jwtError) {
            return res.status(401).json({ message: "Invalid refresh token!" });
        }

        // Check if token exists in database
        const [results] = await db.query('SELECT * FROM refresh_tokens WHERE token = ?', [refresh_token]);
        const tokenData = results[0];
        
        if (!tokenData) {
            return res.status(401).json({ message: "Refresh token not found in database!" });
        }

        // Check if token has expired
        if (new Date(tokenData.expired_at) < new Date()) {
            await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);
            return res.status(401).json({ message: "Refresh token expired!" });
        }

        // Get user data
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: "User not found!" });
        }

        // Generate new access token
        const access_token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, { expiresIn: '15m' });
        
        // Set cookie with new access token
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
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
const logout = async (req,res) => {
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
}
module.exports = { register, login, refreshToken, getMe, logout };