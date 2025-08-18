const sharp = require("sharp");
const axios = require("axios");

const userModel = require("../models/userModel");
const postModel = require("../models/postModel");
const verifyJWT = require("../middlewares/verifyJWT");


const userTimers = new Map();
const activeStatus = async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.onlineStatus) {
      await userModel.updateOne({ email }, { $set: { onlineStatus: true } });
      console.log(`🟢 ${email} marked online`);
    }

    if (userTimers.has(email)) clearTimeout(userTimers.get(email));

    const timeout = setTimeout(async () => {
      await userModel.updateOne({ email }, { $set: { onlineStatus: false } });
      userTimers.delete(email);
    }, 4000);

    userTimers.set(email, timeout);
    res.status(200).json({ status: "online" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

const getUserProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}

const search = async (req, res) => {
  try {
    const query = req.query.q || "";
    if (!query.trim()) return res.json({ posts: [], users: [] });

    const email = req.query.email;
    if (!email) return res.status(400).send("Email missing");

    const limit = parseInt(req.query.limit) || 10;
    const regex = new RegExp(query, "i");

    const posts = await postModel.find({ postContent: { $regex: regex } })
      .limit(limit)
      .exec();

    const users = await userModel.find({
      $and: [
        { $or: [{ name: { $regex: regex } }, { email: { $regex: regex } }] },
        { email: { $ne: email } },
      ],
    })
      .limit(limit)
      .exec();

    res.json({ posts, users });
  } catch (err) {
    console.error("Error in search:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
const getMessageData = async (req, res) => {
  try {
    const username = req.params.id;

    const friend = await userModel.findOne({ username });
    if (!friend) return res.status(404).send("Friend not found");

    const friendPost = await postModel.find({ authorUsername: friend.username });

    res.json({ friend, friendPost });
  } catch (err) {
    console.error("Error in getMessageData:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
const makeAdmin = async (req, res) => {
  const { email } = req.params;
  try {
    const result = await userModel.findOneAndUpdate(
      { email },
      { role: "admin" },
      { new: true }
    );
    if (!result) return res.status(404).send({ message: "User not found" });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Failed to make admin", error: err });
  }
};
const removeAdmin = async (req, res) => {
  const { email } = req.params;
  try {
    const result = await userModel.findOneAndUpdate(
      { email },
      { role: "user" },
      { new: true }
    );
    if (!result) return res.status(404).send({ message: "User not found" });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Failed to remove admin", error: err });
  }
};
const uploadProfile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded");

    const compressedBuffer = await sharp(req.file.buffer)
      .resize(500)
      .jpeg({ quality: 80 })
      .toBuffer();

    const base64Image = `data:${req.file.mimetype};base64,${compressedBuffer.toString("base64")}`;

    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      { image: base64Image.split(",")[1] }
    );

    const imageUrl = response.data.data.url;
    const { email } = req.body;
    if (!email) return res.status(400).send("Email missing");

    const result = await userModel.findOneAndUpdate(
      { email },
      { profileImage: imageUrl },
      { new: true, upsert: true }
    );

    res.json({ success: true, imageUrl, user: result });
  } catch (error) {
    console.error("Error in uploadProfile:", error.message);
    res.status(500).send("Upload failed");
  }
};


module.exports = {
  getUserProfile,
  search,
  getMessageData,
  makeAdmin,
  removeAdmin,
  uploadProfile,
  activeStatus
};
