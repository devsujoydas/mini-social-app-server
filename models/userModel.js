// models/User.js
const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: String,
    username: String,
    email: String,
    password: String,
    address: String,
    bio: String,
    profilephotourl: String,
    coverphotourl: String,
    phone: String,
    website: String,
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    createdDate: { type: Date, default: Date.now },
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    myFriends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    onlineStatus: { type: Boolean, default: false },
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    role: { type: String, default: 'user' }
});

module.exports = mongoose.model('User', userSchema);
