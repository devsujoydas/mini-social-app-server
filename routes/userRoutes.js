const express = require("express");
const multer = require("multer");

const userModel = require("../models/userModel");
const postModel = require("../models/postModel");
const verifyJWT = require("../middlewares/verifyJWT");
const { makeAdmin, removeAdmin, uploadProfile } = require("../controllers/userController");

const router = express.Router();
const upload = multer();
 
// Online status tracking
const userTimers = new Map();
router.post("/activeStatus", async (req, res) => {
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
router.get("/profile/:email", verifyJWT, async (req, res) => {
  try {
    const email = req.params.email;
    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}); 
router.get("/updateInfo/:email", verifyJWT, async (req, res) => {
  try {
    const email = req.params.email;
    const user = await userModel.findOne({ email });
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}); 
router.put("/update", async (req, res) => {
  try {
    const { email, name, address, bio, profilePhotoUrl, coverPhotoUrl, phone, website } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const updatedUser = await userModel.updateOne(
      { email },
      { $set: { name, address, bio, profilePhotoUrl, coverPhotoUrl, phone, website } }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}); 
router.put("/updateUsername", async (req, res) => {
  try {
    const { email, username } = req.body;
    if (!email || !username) return res.status(400).json({ message: "Email and username required" });

    const existingUser = await userModel.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "This username already existed" });

    const result = await userModel.updateOne({ email }, { $set: { username } });
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}); 
router.delete("/profile/delete/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const userDeleted = await userModel.deleteOne({ email });
    const postsDeleted = await postModel.deleteMany({ author: email });
    const likesUpdated = await postModel.updateMany({}, { $pull: { likes: email } });

    res.status(200).json({
      message: "✅ Account and related data deleted successfully",
      userDeleted: userDeleted.deletedCount,
      postsDeleted: postsDeleted.deletedCount,
      likesUpdated: likesUpdated.modifiedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}); 

router.put("/make-admin/:email", makeAdmin);
router.put("/remove-admin/:email", removeAdmin);
router.post("/upload-profile", upload.single("profileImage"), uploadProfile);

module.exports = router;
