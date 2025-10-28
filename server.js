require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./src/configs/connectDB");
const authRoutes = require("./src/modules/auth/authRoutes");
const userRoutes = require("./src/modules/users/userRoutes");
const postRoutes = require("./src/modules/posts/postRoutes");
const friendRoutes = require("./src/modules/friends/friendRoutes");
const { PORT } = require("./src/configs/config");

const app = express();
const port = PORT || 3000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://xenonmedia.netlify.app",
      "https://xenonmedia.vercel.app",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

connectDB();

app.use("/api/v2/auth", authRoutes);
app.use("/api/v2/users", userRoutes);
app.use("/api/v2/posts", postRoutes);
app.use("/api/v2/friends", friendRoutes);

app.get("/", (req, res) =>
  res.send("🟢 Xenon Media Connected With Server & MongoDB")
);

app.listen(port, () => {
  console.log(`🟢 Mongoose Server running on port ${port}`);
});

module.exports = app;
