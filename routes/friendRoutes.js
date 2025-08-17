const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/verifyJWT");
const userModel = require("../models/userModel");
const mongoose = require("mongoose");

// 🔹 Get all users except me
router.get("/allUsers", verifyJWT, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send("Email missing");

    const allUsers = await userModel.find({ email: { $ne: email } });
    res.json(allUsers);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Get a friend's profile and posts
router.get("/friends/:username", verifyJWT, async (req, res) => {
  try {
    const { username } = req.params;
    const friend = await userModel.findOne({ username }).populate("posts");
    if (!friend) return res.status(404).json({ message: "Friend not found" });

    res.json(friend);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Get my friends
router.get("/myfriends", verifyJWT, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send("Email missing");

    const user = await userModel.findOne({ email }).populate("myFriends");
    if (!user) return res.status(404).send("User not found");

    res.json(user.myFriends || []);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Friend requests
router.get("/requests", verifyJWT, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send("Email missing");

    const user = await userModel.findOne({ email }).populate("friendRequests");
    if (!user) return res.status(404).send("User not found");

    res.json(user.friendRequests || []);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Sent requests
router.get("/sentrequest", verifyJWT, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send("Email missing");

    const user = await userModel.findOne({ email }).populate("sentRequests");
    if (!user) return res.status(404).send("User not found");

    res.json(user.sentRequests || []);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 People you may know
router.get("/youMayKnow", verifyJWT, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send("Email missing");

    const user = await userModel.findOne({ email }).populate("myFriends friendRequests sentRequests");
    if (!user) return res.status(404).send("User not found");

    const excludeIds = [
      user._id.toString(),
      ...(user.myFriends || []).map(u => u._id.toString()),
      ...(user.friendRequests || []).map(u => u._id.toString()),
      ...(user.sentRequests || []).map(u => u._id.toString())
    ];

    const allUsers = await userModel.find();
    const youMayKnow = allUsers.filter(u => !excludeIds.includes(u._id.toString()));

    res.json(youMayKnow);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Send friend request
router.put("/addfriend", verifyJWT, async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) return res.status(400).send("Invalid payload");

    const userObjId = mongoose.Types.ObjectId(userId);
    const friendObjId = mongoose.Types.ObjectId(friendId);

    // Add friend request
    await userModel.updateOne({ _id: friendObjId }, { $addToSet: { friendRequests: userObjId } });
    await userModel.updateOne({ _id: userObjId }, { $addToSet: { sentRequests: friendObjId } });

    res.json({ message: "Request sent" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Cancel received request
router.put("/cancelreceivedrequest", verifyJWT, async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    const userObjId = mongoose.Types.ObjectId(userId);
    const friendObjId = mongoose.Types.ObjectId(friendId);

    await userModel.updateOne({ _id: userObjId }, { $pull: { friendRequests: friendObjId } });
    await userModel.updateOne({ _id: friendObjId }, { $pull: { sentRequests: userObjId } });

    res.json({ message: "Received request declined" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Cancel sent request
router.put("/cancelsentrequest", verifyJWT, async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    const userObjId = mongoose.Types.ObjectId(userId);
    const friendObjId = mongoose.Types.ObjectId(friendId);

    await userModel.updateOne({ _id: userObjId }, { $pull: { sentRequests: friendObjId } });
    await userModel.updateOne({ _id: friendObjId }, { $pull: { friendRequests: userObjId } });

    res.json({ message: "Sent request canceled" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Confirm friend request
router.put("/confirmFriend", verifyJWT, async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) return res.status(400).send("Missing IDs");

    const userObjId = mongoose.Types.ObjectId(userId);
    const friendObjId = mongoose.Types.ObjectId(friendId);

    await userModel.updateOne({ _id: userObjId }, { $pull: { friendRequests: friendObjId }, $addToSet: { myFriends: friendObjId } });
    await userModel.updateOne({ _id: friendObjId }, { $pull: { sentRequests: userObjId }, $addToSet: { myFriends: userObjId } });

    res.json({ message: "Request accepted" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// 🔹 Unfriend
router.put("/unfriend", verifyJWT, async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    const userObjId = mongoose.Types.ObjectId(userId);
    const friendObjId = mongoose.Types.ObjectId(friendId);

    await userModel.updateOne({ _id: userObjId }, { $pull: { myFriends: friendObjId } });
    await userModel.updateOne({ _id: friendObjId }, { $pull: { myFriends: userObjId } });

    res.json({ message: "Unfriend successful" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

module.exports = router;
