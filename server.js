require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { connectDB } = require("./utils/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const friendRoutes = require("./routes/friendRoutes");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: ['https://xenonmedia.netlify.app', 'http://localhost:5173', 'https://xenonmedia.vercel.app'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection
connectDB();

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/posts", postRoutes);
app.use("/friends", friendRoutes);

app.get("/", (req, res) => {
    res.send("XENON MEDIA v2");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
