const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    bio: { type: String, default: "" },
    profilePhotoUrl: { type: String, default: "" },
    coverPhotoUrl: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    socialLinks: {
      facebook: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      github: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    myFriends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    onlineStatus: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
