const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const verifyJWT = require("../middleware/verifyJWT");

router.post("/:postId/comment", verifyJWT, async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;
  const userId = req.user.id; // from JWT middleware

  if (!text) return res.status(400).json({ message: "Comment text is required" });

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = { user: userId, text };
    post.comments.push(comment);
    await post.save();

    const populatedPost = await post.populate("comments.user", "name username profilePhotoUrl");
    res.status(200).json(populatedPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
