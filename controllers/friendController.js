const { ObjectId } = require("mongodb");
const { connectDB } = require("../utils/db");

// Send friend request
async function addFriend(req, res) {
    try {
        const { userId, friendId } = req.body;
        if (!userId || !friendId) return res.status(400).send("Invalid payload");

        const db = await connectDB();
        const usersCollection = db.collection("users");

        const userObjId = new ObjectId(userId);
        const friendObjId = new ObjectId(friendId);

        const friend = await usersCollection.findOne({ _id: friendObjId });
        const alreadySent = friend?.friendRequests?.some(id => id.equals(userObjId));
        if (alreadySent) return res.status(409).json({ message: "Already sent request" });

        await usersCollection.updateOne(
            { _id: friendObjId },
            { $addToSet: { friendRequests: userObjId } }
        );
        await usersCollection.updateOne(
            { _id: userObjId },
            { $addToSet: { sentRequests: friendObjId } }
        );

        res.json({ message: "Request sent" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Cancel received request
async function cancelReceivedRequest(req, res) {
    try {
        const { userId, friendId } = req.body;
        const db = await connectDB();
        const usersCollection = db.collection("users");

        const userObjId = new ObjectId(userId);
        const friendObjId = new ObjectId(friendId);

        await usersCollection.updateOne(
            { _id: userObjId },
            { $pull: { friendRequests: friendObjId } }
        );
        await usersCollection.updateOne(
            { _id: friendObjId },
            { $pull: { sentRequests: userObjId } }
        );

        res.json({ message: "Received request declined" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Cancel sent request
async function cancelSentRequest(req, res) {
    try {
        const { userId, friendId } = req.body;
        const db = await connectDB();
        const usersCollection = db.collection("users");

        const userObjId = new ObjectId(userId);
        const friendObjId = new ObjectId(friendId);

        await usersCollection.updateOne(
            { _id: userObjId },
            { $pull: { sentRequests: friendObjId } }
        );
        await usersCollection.updateOne(
            { _id: friendObjId },
            { $pull: { friendRequests: userObjId } }
        );

        res.json({ message: "Sent request canceled" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Confirm friend request
async function confirmFriend(req, res) {
    try {
        const { userId, friendId } = req.body;
        if (!userId || !friendId) return res.status(400).send("Missing IDs");

        const db = await connectDB();
        const usersCollection = db.collection("users");

        const userObjId = new ObjectId(userId);
        const friendObjId = new ObjectId(friendId);

        const user = await usersCollection.findOne({ _id: userObjId });
        const friend = await usersCollection.findOne({ _id: friendObjId });
        if (!user || !friend) return res.status(404).send("User or Friend not found");

        const hasRequest = user.friendRequests?.some(id => id.equals(friendObjId));
        if (!hasRequest) return res.status(400).send("No friend request found");

        await usersCollection.updateOne(
            { _id: userObjId },
            { $pull: { friendRequests: friendObjId }, $addToSet: { myFriends: friendObjId } }
        );
        await usersCollection.updateOne(
            { _id: friendObjId },
            { $pull: { sentRequests: userObjId }, $addToSet: { myFriends: userObjId } }
        );

        res.json({ message: "Request accepted" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Unfriend
async function unfriend(req, res) {
    try {
        const { userId, friendId } = req.body;
        if (!userId || !friendId) return res.status(400).send("Invalid payload");

        const db = await connectDB();
        const usersCollection = db.collection("users");

        const userObjId = new ObjectId(userId);
        const friendObjId = new ObjectId(friendId);

        await usersCollection.updateOne(
            { _id: userObjId },
            { $pull: { myFriends: friendObjId } }
        );
        await usersCollection.updateOne(
            { _id: friendObjId },
            { $pull: { myFriends: userObjId } }
        );

        res.json({ message: "Unfriend successful" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

module.exports = {
    addFriend,
    cancelReceivedRequest,
    cancelSentRequest,
    confirmFriend,
    unfriend
};
