// userRoutes.js
const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { ObjectId } = require("mongodb");

module.exports = (usersCollection) => {
    const router = express.Router();

    // =============================
    // Email দিয়ে profile fetch করা
    // =============================
    router.get("/:email", verifyToken, async (req, res) => {
        try {
            const user = await usersCollection.findOne({ email: req.params.email });
            if (!user) return res.status(404).json({ message: "User not found" });
            res.json(user);
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // User info update করা
    // =============================
    router.put("/update", verifyToken, async (req, res) => {
        try {
            const { email, name, bio, phone, website } = req.body;
            const result = await usersCollection.updateOne(
                { email },
                { $set: { name, bio, phone, website } }
            );
            res.json({ message: "User info updated", result });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Profile image upload করা
    // =============================
    router.post("/upload-profile", verifyToken, upload.single("profile"), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: "No file uploaded" });

            await usersCollection.updateOne(
                { email: req.user.email },
                { $set: { profileImage: req.file.path } }
            );

            res.json({ message: "Profile image updated", path: req.file.path });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Online / Offline status update
    // =============================
    router.put("/status", verifyToken, async (req, res) => {
        try {
            const { status } = req.body; // 'online' | 'offline'
            await usersCollection.updateOne(
                { email: req.user.email },
                { $set: { onlineStatus: status } }
            );
            res.json({ message: `Status updated to ${status}` });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Post save করা
    // =============================
    router.put("/save-post/:postId", verifyToken, async (req, res) => {
        try {
            const postId = new ObjectId(req.params.postId);
            await usersCollection.updateOne(
                { email: req.user.email },
                { $addToSet: { savedPosts: postId } }
            );
            res.json({ message: "Post saved" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Saved post remove করা
    // =============================
    router.put("/remove-saved/:postId", verifyToken, async (req, res) => {
        try {
            const postId = new ObjectId(req.params.postId);
            await usersCollection.updateOne(
                { email: req.user.email },
                { $pull: { savedPosts: postId } }
            );
            res.json({ message: "Post removed from saved" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Name / Email দিয়ে user search
    // =============================
    router.get("/search/:query", verifyToken, async (req, res) => {
        try {
            const query = req.params.query;
            const users = await usersCollection.find({
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { email: { $regex: query, $options: "i" } }
                ]
            }).toArray();
            res.json(users);
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    return router;
};
