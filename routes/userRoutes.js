const express = require("express");
const multer = require("multer");

const userModel = require("../models/userModel");
const postModel = require("../models/postModel");
const verifyJWT = require("../middlewares/verifyJWT");
const {getUserProfile, makeAdmin, removeAdmin, uploadProfile ,activeStatus} = require("../controllers/userController");

const router = express.Router();
const upload = multer();
 
// Online status tracking

router.post("/activeStatus",activeStatus);

router.get("/profile/:email", verifyJWT, getUserProfile); 

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
