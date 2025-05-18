const mongoose = require('mongoose');
const user = require('./user');

const postSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },

    postImage: String,
    description: String,

    date: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
})

module.exports = mongoose.model("post", postSchema)


