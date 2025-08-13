const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");

const {
    addFriend,
    cancelReceivedRequest,
    cancelSentRequest,
    confirmFriend,
    unfriend
} = require("../controllers/friendController");

router.put("/addfriend", verifyToken, addFriend);
router.put("/cancelreceivedrequest", verifyToken, cancelReceivedRequest);
router.put("/cancelsentrequest", verifyToken, cancelSentRequest);
router.put("/confirmFriend", verifyToken, confirmFriend);
router.put("/unfriend", verifyToken, unfriend);

module.exports = router;
