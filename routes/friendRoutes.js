const express = require("express");
const mongoose = require("mongoose");

const userModel = require("../models/userModel");
const postModel = require("../models/postModel");
const verifyJWT = require("../middlewares/verifyJWT");

const router = express.Router();


router.get("/allUsers",  async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send("Email missing");

    const allUsers = await userModel.find({ email: { $ne: email } });
    console.log(allUsers)
    res.json(allUsers);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});
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

router.put("/addfriend", verifyJWT, async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) return res.status(400).send("Invalid payload");

    const userObjId = mongoose.Types.ObjectId(userId);
    const friendObjId = mongoose.Types.ObjectId(friendId);

    await userModel.updateOne({ _id: friendObjId }, { $addToSet: { friendRequests: userObjId } });
    await userModel.updateOne({ _id: userObjId }, { $addToSet: { sentRequests: friendObjId } });

    res.json({ message: "Request sent" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});
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
router.put("/confirmFriend", verifyJWT, async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) return res.status(400).send("Missing IDs");

    const userObjId = mongoose.Types.ObjectId(userId);
    const friendObjId = mongoose.Types.ObjectId(friendId);

    await userModel.updateOne(
      { _id: userObjId },
      { $pull: { friendRequests: friendObjId }, $addToSet: { myFriends: friendObjId } }
    );
    await userModel.updateOne(
      { _id: friendObjId },
      { $pull: { sentRequests: userObjId }, $addToSet: { myFriends: userObjId } }
    );

    res.json({ message: "Request accepted" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});
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