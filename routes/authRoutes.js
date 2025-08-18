const express = require("express");
const router = express.Router();


const userModel = require("../models/userModel");
const postModel = require("../models/postModel");
const verifyJWT = require("../middlewares/verifyJWT");
const { createJwt, signup, signInWithGoogle, fotgotPassword, logout } = require("../controllers/authController");


router.post("/jwt", createJwt);
router.post("/signup", signup);
router.post("/signInWithGoogle", signInWithGoogle);
router.post("/forgotPass", fotgotPassword);
router.post("/logout", logout);




module.exports = router;
