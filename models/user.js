const mongoose = require('mongoose');

mongoose.connect(`mongodb://127.0.0.1:27017/mini-social-app`)

const userSchema = mongoose.Schema({
    profilePhoto: { type: String, default: "default.jpg" },
    firstName: String,
    lastName: String,
    userName: String,
    address: String,
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "post" },],
    followers: Number,
    following: Number,
    aboutme: String,
    phone: Number,
    email: String,
    website: String,
    password: String,
})

module.exports = mongoose.model("user", userSchema)





