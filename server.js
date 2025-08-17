const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const connectDB = require("./utils/db");
const verifyJWT = require("./middlewares/verifyJWT");

const userModel = require("../models/userModel");
const postModel = require("../models/postModel");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const friendRoutes = require("./routes/friendRoutes");


const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: ["http://localhost:5173", "https://xenonmedia.netlify.app", "https://xenonmedia.vercel.app"], credentials: true }));
app.use(express.json());
app.use(cookieParser());
connectDB();

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



app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/posts", postRoutes);
app.use("/friends", friendRoutes);





app.get("/", (req, res) => res.send("🟢 Xenon Media Connected With Server & MongoDB"));
app.listen(port, () => console.log(`🟢 Server running on port ${port}`));

module.exports = app;
