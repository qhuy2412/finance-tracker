const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const User = require('../model/userModel');

const register = async (req, res) => {
    try {
        const { username, email, password, confirmationPassword } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Username, email, and password are required!" })
        }
        if (password !== confirmationPassword) {
            return res.status(400).json({ message: "Confirmation password is incorrect!" });
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
}
module.exports = { register, login };