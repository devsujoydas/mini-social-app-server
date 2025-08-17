// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const postModel = require("../models/postModel");
const verifyJWT = require("../middlewares/verifyJWT");



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
        const { name, email, address, bio, profilePhotoUrl, coverPhotoUrl, phone, website } = req.body;
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
        const existingUser = await userModel.findOne({ username });

        if (existingUser) {
            return res.status(400).json({ message: "This username already existed" });
        }

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

        // Delete user
        const userDeleted = await userModel.deleteOne({ email });

        // Delete all posts
        const postsDeleted = await postModel.deleteMany({ author: email });

        // Remove likes from all posts
        const likesUpdated = await postModel.updateMany(
            {},
            { $pull: { likes: email } }
        );

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






module.exports = router;
