const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const User = require('../model/userModel');

const register = async (req,res) => {
    try{
        const {username, email, password, confirmationPassword} = req.body;
        if(!username || !email || !password){
            return res.status(400).json({message: "Username, email, and password are required!"})
        }
        if(password !== confirmationPassword) {
            return res.status(400).json({message: "Confirmation password is incorrect!"});
        }
        const existingEmail = await User.findByEmail(email);
        if(existingEmail){
            return res.status(400).json({message: "Email already use!"});
        }
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password,salt);
        const userId = uuidv4().trim();
        await User.create(userId,username,email,hashPassword);
        return res.status(201).json({message: "Register successfully!"});
    }catch (error) {
        return res.status(500).json({message: error.message});
    }
}

module.exports = {register, login};