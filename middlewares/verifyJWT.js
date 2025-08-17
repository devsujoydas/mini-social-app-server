// middlewares/verifyJWT.js
const jwt = require("jsonwebtoken");

const verifyJWT = (req, res, next) => {
    try {
        const token = req.cookies?.token || req.headers["authorization"]?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded; // এই info পরবর্তী route এ ব্যবহার করতে পারবে
        next();
    } catch (error) {
        console.error("JWT verification error:", error);
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
};

module.exports = verifyJWT;
