const express = require("express");
const router = express.Router();

const userModel = require("../models/userModel");
const postModel = require("../models/postModel");
const verifyJWT = require("../../middlewares/verifyJWT");
const { default: mongoose } = require("mongoose");

router.get("/", async (req, res) => {
  try {
    const posts = await postModel.aggregate([{ $sample: { size: await postModel.countDocuments() } }]);
    res.json(posts);
  } catch (error) {
    console.error("Error getting posts:", error);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});
router.post("/", async (req, res) => {
  try {
    const postData = req.body;

    const existingPost = await postModel.findOne({ postImageUrl: postData.postImageUrl });
    if (existingPost) return res.status(409).json({ message: "This Image URL was already taken" });

    const newPost = await postModel.create(postData);

    // Update user's posts array
    await userModel.updateOne({ _id: postData.author }, { $push: { posts: newPost._id } });

    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
});


// router.get("/:id", async (req, res) => {
//   console.log("hello")
//   console.log(req.params.id)
//   try {
//     const post = await postModel.find({ _id: ObjectId("686aa2663a24253535c0fb49") }).populate("author", "name username profilePhotoUrl");
//     if (!post) return res.status(404).json({ message: "Post not found" });
//     res.json(post);
//   } catch (error) {
//     console.error("Error fetching post:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }); 

// router.get("/:id", async (req, res) => {
//   const id = req.params.id;
//   console.log("Received ID:", id);

//   try {
//     const post = await postModel.findById(id).populate("author", "name username profilePhotoUrl");
//     console.log("Found Post:", post);

//     if (!post) {
//       console.log("No post found with that ID");
//       return res.status(404).json({ message: "Post not found" });
//     }

//     res.json(post);
//   } catch (error) {
//     console.error("Error fetching post:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

router.get("/:id", async (req, res) => {
  console.log("Received ID:", req.params.id);

  try {
    const id = new mongoose.Types.ObjectId(req.params.id); // ✅ Convert to ObjectId
    const post = await postModel
      .findById(id)
      .populate("author", "name username profilePhotoUrl");

    console.log("Found Post:", post);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/update/:id", async (req, res) => {
  try {
    const { postContent, postImageUrl } = req.body;
    const updatedPost = await postModel.findByIdAndUpdate(
      req.params.id,
      { postContent, postImageUrl, lastUpdateDate: new Date() },
      { new: true }
    );
    res.json(updatedPost);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ message: "Failed to update post" });
  }
});
router.delete("/delete/:id", async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Remove post from author's posts array
    await userModel.updateOne({ _id: post.author }, { $pull: { posts: post._id } });

    await post.remove();
    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

router.put("/like/:id", async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await postModel.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = post.likes.includes(userId);
    if (alreadyLiked) {
      post.likes.pull(userId);
      await post.save();
      return res.json({ message: "Disliked", post });
    } else {
      post.likes.addToSet(userId);
      await post.save();
      return res.json({ message: "Liked", post });
    }
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:postId/comment", async (req, res) => {
  const { postId } = req.params;
  const { userId, text } = req.body;
  if (!text) return res.status(400).json({ message: "Comment cannot be empty" });

  try {
    const post = await postModel.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ user: userId, text });
    await post.save();

    res.status(201).json({ success: true, comments: post.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/:postId/comments", async (req, res) => {
  const { postId } = req.params;
  try {
    const post = await postModel.findById(postId).populate("comments.user", "name profilePhotoUrl username");
    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json(post.comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.delete("/:postId/comment/:commentId", async (req, res) => {
  const { postId, commentId } = req.params;
  try {
    const post = await postModel.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.id(commentId).remove();
    await post.save();

    res.json({ message: "Comment deleted successfully", comments: post.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
