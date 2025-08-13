const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Unauthorized access" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: "Unauthorized access" });
        req.user = decoded;
        next();
    });
}

module.exports = verifyToken;
