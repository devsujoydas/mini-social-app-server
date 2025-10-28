const express = require("express");
const mongoose = require("mongoose");

const verifyJWT = require("../../middlewares/verifyJWT");
const { getAllUser, getFriend, myFriends, requests, sentrequest, youMayKnow, addFriend, cancelsentrequest, cancelreceivedrequest, confirmFriend, unfriend } = require("./friendController");

const router = express.Router();


router.get("/allUsers", getAllUser);
router.get("/friends/:username", verifyJWT, getFriend);
router.get("/myfriends", verifyJWT, myFriends);
router.get("/requests", verifyJWT, requests);
router.get("/sentrequest", verifyJWT, sentrequest);
router.get("/youMayKnow", verifyJWT, youMayKnow);

router.put("/addfriend", verifyJWT, addFriend);
router.put("/cancelsentrequest", verifyJWT, cancelsentrequest);
router.put("/cancelreceivedrequest", verifyJWT, cancelreceivedrequest);
router.put("/confirmFriend", verifyJWT, confirmFriend);
router.put("/unfriend", verifyJWT, unfriend);




module.exports = router;