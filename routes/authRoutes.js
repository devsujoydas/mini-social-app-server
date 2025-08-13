const express = require("express");
const router = express.Router();
const { generateToken, logout } = require("../controllers/authController");

router.post("/jwt", generateToken);
router.post("/logout", logout);

module.exports = router;
