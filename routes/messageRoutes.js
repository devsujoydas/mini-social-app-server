const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const { getFriendMessages } = require("../controllers/messageController");

router.get("/:id", verifyToken, getFriendMessages);

module.exports = router;
