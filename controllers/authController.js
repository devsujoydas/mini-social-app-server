const jwt = require("jsonwebtoken");

const generateToken = (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ success: true });
};

const logout = (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: true });
    res.status(200).json({ message: "Logged out successfully" });
};

module.exports = { generateToken, logout };
