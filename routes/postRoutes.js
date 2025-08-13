// postRoutes.js
const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const { ObjectId } = require("mongodb");

module.exports = (postsCollection, usersCollection) => {
    const router = express.Router();

    // =============================
    // সব post দেখানো
    // =============================
    router.get("/", async (req, res) => {
        try {
            const posts = await postsCollection.find().toArray();
            res.json(posts);
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // ID দিয়ে single post fetch
    // =============================
    router.get("/:id", async (req, res) => {
        try {
            const post = await postsCollection.findOne({ _id: new ObjectId(req.params.id) });
            if (!post) return res.status(404).json({ message: "Post not found" });
            res.json(post);
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // নতুন post create করা
    // =============================
    router.post("/", verifyToken, async (req, res) => {
        try {
            const { postContent, postImageUrl } = req.body;
            const authorEmail = req.user.email;

            const newPost = { postContent, postImageUrl, authorEmail, likes: [], createdAt: new Date() };
            const result = await postsCollection.insertOne(newPost);

            // User collection update (push post ID)
            await usersCollection.updateOne(
                { email: authorEmail },
                { $push: { posts: result.insertedId } }
            );

            res.json({ message: "Post created", postId: result.insertedId });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Like / Unlike post
    // =============================
    router.put("/like/:id", verifyToken, async (req, res) => {
        try {
            const userEmail = req.user.email;
            const postId = new ObjectId(req.params.id);

            const post = await postsCollection.findOne({ _id: postId });
            if (!post) return res.status(404).json({ message: "Post not found" });

            const alreadyLiked = post.likes.includes(userEmail);

            if (alreadyLiked) {
                await postsCollection.updateOne(
                    { _id: postId },
                    { $pull: { likes: userEmail } }
                );
                return res.json({ message: "Post unliked" });
            } else {
                await postsCollection.updateOne(
                    { _id: postId },
                    { $push: { likes: userEmail } }
                );
                return res.json({ message: "Post liked" });
            }
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // =============================
    // Delete post
    // =============================
    router.delete("/:id", verifyToken, async (req, res) => {
        try {
            const postId = new ObjectId(req.params.id);
            const post = await postsCollection.findOne({ _id: postId });
            if (!post) return res.status(404).json({ message: "Post not found" });

            if (post.authorEmail !== req.user.email) {
                return res.status(403).json({ message: "Unauthorized to delete this post" });
            }

            await postsCollection.deleteOne({ _id: postId });
            await usersCollection.updateOne(
                { email: req.user.email },
                { $pull: { posts: postId } }
            );

            res.json({ message: "Post deleted" });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    return router;
};
