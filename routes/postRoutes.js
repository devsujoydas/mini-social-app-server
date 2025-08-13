const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const verifyToken = require("../middlewares/verifyToken");

const {
    uploadProfile,
    createPost,
    updatePost,
    deletePost,
    likePost,
    savePost,
    removeSavedPost
} = require("../controllers/postController");

// Profile image upload
router.post("/upload-profile", verifyToken, upload.single("profileImage"), uploadProfile);

// Post CRUD
router.post("/post", verifyToken, createPost);
router.put("/post/update/:id", verifyToken, updatePost);
router.delete("/post/delete/:id", verifyToken, deletePost);

// Like / save
router.put("/post/like/:id", verifyToken, likePost);
router.put("/savePost", verifyToken, savePost);
router.put("/removeSavedPost", verifyToken, removeSavedPost);

module.exports = router;
