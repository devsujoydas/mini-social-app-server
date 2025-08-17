const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const connectDB = require("./utils/db");
const UserModel = require("./models/User");
const PostModel = require("./models/Post");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ["http://localhost:5173", "https://xenonmedia.netlify.app", "https://xenonmedia.vercel.app"],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

connectDB();

const verifyJWT = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: "Unauthorized" });
        req.user = decoded;
        next();
    });
};

app.post("/jwt", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, {
        httpOnly: true, secure: false,
        sameSite: "Lax", maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, token });
});

const userTimers = new Map();
app.post("/activeStatus", async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    try {
        const user = await UserModel.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.onlineStatus) {
            user.onlineStatus = true;
            await user.save();
            console.log(`🟢 ${email} marked online`);
        }

        if (userTimers.has(email)) clearTimeout(userTimers.get(email));

        const timeout = setTimeout(async () => {
            await UserModel.updateOne({ email }, { $set: { onlineStatus: false } });
            userTimers.delete(email);
        }, 4000);

        userTimers.set(email, timeout);
        res.status(200).json({ status: "online" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});




app.get("/", (req, res) => res.send("🟢 Server & MongoDB Connected"));
app.listen(port, () => console.log(`🟢 Server running on port ${port}`));

module.exports = app;
