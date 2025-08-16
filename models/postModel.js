// models/Post.js
const mongoose = require('mongoose');

const postSchema = mongoose.Schema({
  authorEmail: String,
  authorPhoto: String,
  authorName: String,
  authorUsername: String,
  postImageUrl: String,
  postContent: String,
  createdDate: { type: Date, default: Date.now },
  lastUpdateDate: { type: Date, default: Date.now },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [],
  shares: []
});

module.exports = mongoose.model('Post', postSchema);
