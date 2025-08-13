const { ObjectId } = require("mongodb");
const { connectDB } = require("../utils/db");
const sharp = require("sharp");
const axios = require("axios");

// Upload profile image
async function uploadProfile(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");

        if (!req.file) return res.status(400).send("No file uploaded");

        // Compress image
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
        const email = req.body.email;
        if (!email) return res.status(400).send("Email missing");

        await usersCollection.updateOne(
            { email },
            { $set: { profileImage: imageUrl } },
            { upsert: true }
        );

        res.json({ success: true, imageUrl });

    } catch (err) {
        console.error(err);
        res.status(500).send("Upload failed");
    }
}

// Create post
async function createPost(req, res) {
    try {
        const db = await connectDB();
        const postsCollection = db.collection("posts");
        const usersCollection = db.collection("users");

        const postData = req.body;
        const existingPost = await postsCollection.findOne({ postImageUrl: postData.postImageUrl });
        if (existingPost) return res.status(409).send("This Image URL was already taken");

        const result = await postsCollection.insertOne(postData);

        // Add post ID to user's posts array
        await usersCollection.updateOne(
            { email: postData.authorEmail },
            { $push: { posts: result.insertedId } }
        );

        res.json({ result });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Update post
async function updatePost(req, res) {
    try {
        const db = await connectDB();
        const postsCollection = db.collection("posts");

        const postId = req.params.id;
        const { postContent, lastUpdateDate } = req.body;

        const result = await postsCollection.updateOne(
            { _id: new ObjectId(postId) },
            { $set: { postContent, lastUpdateDate } }
        );

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Delete post
async function deletePost(req, res) {
    try {
        const db = await connectDB();
        const postsCollection = db.collection("posts");
        const usersCollection = db.collection("users");

        const postId = req.params.id;
        const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
        if (!post) return res.status(404).send("Post not found");

        const authorEmail = post.authorEmail;
        if (authorEmail) {
            await usersCollection.updateOne(
                { email: authorEmail },
                { $pull: { posts: post._id } }
            );
        }

        const result = await postsCollection.deleteOne({ _id: new ObjectId(postId) });
        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Like / dislike post
async function likePost(req, res) {
    try {
        const db = await connectDB();
        const postsCollection = db.collection("posts");

        const postId = req.params.id;
        const { userId } = req.body;

        const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
        if (!post) return res.status(404).send("Post not found");

        const alreadyLiked = post.likes?.includes(userId);
        let updateResult;
        if (alreadyLiked) {
            updateResult = await postsCollection.updateOne(
                { _id: new ObjectId(postId) },
                { $pull: { likes: userId } }
            );
            return res.json({ message: "Disliked", result: updateResult });
        } else {
            updateResult = await postsCollection.updateOne(
                { _id: new ObjectId(postId) },
                { $addToSet: { likes: userId } }
            );
            return res.json({ message: "Liked", result: updateResult });
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Save post
async function savePost(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");
        const postsCollection = db.collection("posts");

        const { userId, postId } = req.body;
        if (!userId || !postId) return res.status(400).send("Missing IDs");

        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        const post = await postsCollection.findOne({ _id: new ObjectId(postId) });

        if (!user || !post) return res.status(404).send("User or Post not found");

        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $addToSet: { savePosts: new ObjectId(postId) } }
        );

        res.json({ message: "Post saved successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Remove saved post
async function removeSavedPost(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");

        const { userId, postId } = req.body;
        if (!userId || !postId) return res.status(400).send("Missing IDs");

        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { savePosts: new ObjectId(postId) } }
        );

        res.json({ message: "Saved post removed" });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

module.exports = {
    uploadProfile,
    createPost,
    updatePost,
    deletePost,
    likePost,
    savePost,
    removeSavedPost
};
