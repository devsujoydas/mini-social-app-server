const { ObjectId } = require("mongodb");
const { connectDB } = require("../utils/db");

// Online status
const userTimers = new Map();
async function setActiveStatus(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");

        const email = req.query.email;
        if (!email) return res.status(400).json({ message: "Email required" });

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.onlineStatus) {
            await usersCollection.updateOne({ email }, { $set: { onlineStatus: true } });
        }

        if (userTimers.has(email)) clearTimeout(userTimers.get(email));
        const timeout = setTimeout(async () => {
            await usersCollection.updateOne({ email }, { $set: { onlineStatus: false } });
            userTimers.delete(email);
        }, 4000);
        userTimers.set(email, timeout);

        res.json({ status: "online" });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Search users and posts
async function search(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");
        const postsCollection = db.collection("posts");

        const query = req.query.q || '';
        const email = req.query.email;
        if (!email) return res.status(400).send("Email missing");

        if (!query.trim()) return res.json({ posts: [], users: [] });

        const regex = new RegExp(query, 'i');

        const posts = await postsCollection.find({ postContent: { $regex: regex } }).toArray();
        const users = await usersCollection.find({
            $and: [
                { $or: [{ name: { $regex: regex } }, { email: { $regex: regex } }] },
                { email: { $ne: email } }
            ]
        }).toArray();

        res.json({ posts, users });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Friend suggestions (you may know)
async function youMayKnow(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");

        const email = req.query.email;
        if (!email) return res.status(400).send("Email missing");

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send("User not found");

        const allUsers = await usersCollection.find().toArray();
        const myIdStr = user._id.toString();
        const friendIds = (user.myFriends || []).map(id => id.toString());
        const requestIds = (user.friendRequests || []).map(id => id.toString());
        const sentRequestIds = (user.sentRequests || []).map(id => id.toString());

        const suggestions = allUsers.filter(u => {
            const uIdStr = u._id.toString();
            return (
                uIdStr !== myIdStr &&
                !friendIds.includes(uIdStr) &&
                !requestIds.includes(uIdStr) &&
                !sentRequestIds.includes(uIdStr)
            );
        });

        res.json(suggestions);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Make admin
async function makeAdmin(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");
        const email = req.params.email;

        const result = await usersCollection.updateOne(
            { email },
            { $set: { role: "admin" } }
        );
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to make admin");
    }
}

// Remove admin
async function removeAdmin(req, res) {
    try {
        const db = await connectDB();
        const usersCollection = db.collection("users");
        const email = req.params.email;

        const result = await usersCollection.updateOne(
            { email },
            { $set: { role: "user" } }
        );
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to remove admin");
    }
}

module.exports = { setActiveStatus, search, youMayKnow, makeAdmin, removeAdmin };
