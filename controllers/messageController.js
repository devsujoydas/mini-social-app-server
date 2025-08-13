const { ObjectId } = require("mongodb");
const { connectDB } = require("../utils/db");

// Get friend + posts
async function getFriendMessages(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");
        const postsCollection = db.collection("posts");

        const username = req.params.id;
        const friend = await usersCollection.findOne({ username });
        if (!friend) return res.status(404).send("Friend not found");

        const posts = await postsCollection.find({ authorUsername: friend.username }).toArray();
        res.json({ friend, friendPost: posts });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

module.exports = { getFriendMessages };
