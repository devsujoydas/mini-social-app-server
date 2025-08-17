// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");

router.post("/signup", async (req, res) => {
    try {
        const formData = req.body;
        const existingUser = await userModel.findOne({ email: formData.email });
        if (existingUser) return res.status(400).json({ message: "User already existed" });

        const user = await userModel.create(formData);
        res.status(201).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
router.post("/signinwithgoogle", async (req, res) => {
    try {
        const formData = req.body;
        let user = await userModel.findOne({ email: formData.email });

        if (!user) {
            user = await userModel.create(formData);
        }

        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
router.post("/forgotPass", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ message: "User found" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
    });
    res.json({ success: true });
});

module.exports = router;
