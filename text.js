// Imports packages
require("dotenv").config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

// Import DB connect and models
const connectDB = require('./utils/db');
const UserModel = require('./models/userModel');
const PostModel = require('./models/postModel');

// Create app and port
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:5173', 'https://xenonmedia.netlify.app', 'https://xenonmedia.vercel.app'],
    credentials: true
}));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// JWT middleware
const verifyJWT = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: "Unauthorized" });
        req.user = decoded;
        next();
    });
};


// Routes
app.get("/", (req, res) => {
    res.send("Server is running...");
});

// User registration
app.post("/register", async (req, res) => {
    try {
        const { name, username, email, password } = req.body;

        const existingUser = await UserModel.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new UserModel({ name, username, email, password: hashedPassword });
        await newUser.save();

        res.json({ message: "User registered successfully", user: newUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Login route
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await UserModel.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Invalid password" });

        const token = jwt.sign({ email: user.email, id: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // production এ true
            sameSite: "Lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({ message: "Login successful", token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Logout route
app.post("/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
});

// Get profile (protected)
app.get("/profile/:email", verifyJWT, async (req, res) => {
    try {
        const user = await UserModel.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Create post (protected)
app.post("/posts", verifyJWT, async (req, res) => {
    try {
        const { postContent, postImageUrl } = req.body;
        const author = await UserModel.findOne({ email: req.user.email });
        if (!author) return res.status(404).json({ message: "Author not found" });

        const newPost = new Post({
            authorEmail: author.email,
            authorName: author.name,
            authorUsername: author.username,
            authorPhoto: author.profilephotourl,
            postContent,
            postImageUrl
        });

        const savedPost = await newPost.save();

        author.posts.push(savedPost._id);
        await author.save();

        res.json({ message: "Post created", post: savedPost });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get all posts (protected)
app.get("/posts", verifyJWT, async (req, res) => {
    try {
        const posts = await PostModel.find().populate("likes", "name username email profilephotourl");
        res.json(posts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Connect DB and start server
connectDB()
    .then(() => {})
    .catch(err => console.error("DB connection failed:", err));

app.listen(port, () => {
    console.log(`Server ${port} & MongoDB connected 🟢`);
});
