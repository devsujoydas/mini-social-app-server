// friendRoutes.js
const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const { ObjectId } = require("mongodb");

module.exports = (usersCollection) => {
    const router = express.Router();

    // =============================
    // সব user দেখাবে except self
    // =============================
    router.get("/all", verifyToken, async (req, res) => {
        try {
            const email = req.user.email;
            const users = await usersCollection.find({ email: { $ne: email } }).toArray();
            res.json(users);
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Friend request পাঠানো
    // =============================
    router.put("/add", verifyToken, async (req, res) => {
        try {
            const { friendId } = req.body;
            if (!friendId) return res.status(400).json({ message: "friendId missing" });

            const userId = req.user._id;

            // অন্য user এর friendRequests update
            await usersCollection.updateOne(
                { _id: new ObjectId(friendId) },
                { $addToSet: { friendRequests: new ObjectId(userId) } }
            );

            // নিজের sentRequests update
            await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $addToSet: { sentRequests: new ObjectId(friendId) } }
            );

            res.json({ message: "Friend request sent" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Received request decline করা
    // =============================
    router.put("/cancel-received", verifyToken, async (req, res) => {
        try {
            const { userId } = req.body; // request sender
            const myId = req.user._id;

            await usersCollection.updateOne(
                { _id: new ObjectId(myId) },
                { $pull: { friendRequests: new ObjectId(userId) } }
            );
            await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $pull: { sentRequests: new ObjectId(myId) } }
            );

            res.json({ message: "Received request declined" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Sent request cancel করা
    // =============================
    router.put("/cancel-sent", verifyToken, async (req, res) => {
        try {
            const { friendId } = req.body;
            const myId = req.user._id;

            await usersCollection.updateOne(
                { _id: new ObjectId(myId) },
                { $pull: { sentRequests: new ObjectId(friendId) } }
            );
            await usersCollection.updateOne(
                { _id: new ObjectId(friendId) },
                { $pull: { friendRequests: new ObjectId(myId) } }
            );

            res.json({ message: "Sent request canceled" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Friend request accept করা
    // =============================
    router.put("/confirm", verifyToken, async (req, res) => {
        try {
            const { userId } = req.body; // request sender
            const myId = req.user._id;

            await usersCollection.updateOne(
                { _id: new ObjectId(myId) },
                { $pull: { friendRequests: new ObjectId(userId) }, $addToSet: { myFriends: new ObjectId(userId) } }
            );
            await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $pull: { sentRequests: new ObjectId(myId) }, $addToSet: { myFriends: new ObjectId(myId) } }
            );

            res.json({ message: "Friend request accepted" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Unfriend করা
    // =============================
    router.put("/unfriend", verifyToken, async (req, res) => {
        try {
            const { friendId } = req.body;
            const myId = req.user._id;

            await usersCollection.updateOne(
                { _id: new ObjectId(myId) },
                { $pull: { myFriends: new ObjectId(friendId) } }
            );
            await usersCollection.updateOne(
                { _id: new ObjectId(friendId) },
                { $pull: { myFriends: new ObjectId(myId) } }
            );

            res.json({ message: "Unfriended successfully" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    return router;
};
