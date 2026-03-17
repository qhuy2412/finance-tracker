const db = require("../config/db");
const Wallet = require("../model/walletModel");

const getAllWallets = async (req, res) => {
    try {
        const userId = req.user.id;
        const wallets = await Wallet.getAllWalletsByUserId(userId);
        return res.status(200).json(wallets);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
module.exports = {getAllWallets};