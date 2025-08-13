const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

module.exports = (usersCollection) => {
    const router = express.Router();

    // ======================
    // Register (Sign Up)
    // ======================
    router.post("/register", async (req, res) => {
        try {
            const { name, email, password } = req.body;

            // Basic validation
            if (!name || !email || !password) {
                return res.status(400).json({ message: "সব তথ্য পূরণ করতে হবে" });
            }

            // Check email already exists
            const existingUser = await usersCollection.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: "এই ইমেইল ব্যবহার হয়েছে" });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const newUser = {
                name,
                email,
                password: hashedPassword,
                friendRequests: [],
                sentRequests: [],
                myFriends: [],
                createdAt: new Date()
            };

            const result = await usersCollection.insertOne(newUser);

            // Generate JWT token
            const token = jwt.sign(
                { _id: result.insertedId, email },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.status(201).json({ message: "রেজিস্ট্রেশন সফল", token });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // ======================
    // Login
    // ======================
    router.post("/login", async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ message: "ইমেইল এবং পাসওয়ার্ড দিতে হবে" });
            }

            const user = await usersCollection.findOne({ email });
            if (!user) {
                return res.status(400).json({ message: "ইমেইল বা পাসওয়ার্ড ভুল" });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: "ইমেইল বা পাসওয়ার্ড ভুল" });
            }

            // Generate JWT token
            const token = jwt.sign(
                { _id: user._id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.json({ message: "লগইন সফল", token });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    });

    return router;
};
