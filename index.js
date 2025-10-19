const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
var cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require("axios");
require("dotenv").config()

const app = express()
const port = process.env.PORT || 3000

const sharp = require("sharp");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });



app.use(cors({
    origin: ['https://xenonmedia.netlify.app', 'http://localhost:5173', "https://xenonmedia.vercel.app"],
    credentials: true
}));

app.use(express.json())
app.use(cookieParser())

const uri = process.env.MONGO_ATLAS_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const userTimers = new Map();

async function run() {
    try {
        const usersCollection = client.db("mini-social-app").collection("users")
        const postsCollection = client.db("mini-social-app").collection("posts")
        const chatRoomsCollection = client.db("mini-social-app").collection("chatRoom")
        const chatsCollection = client.db("mini-social-app").collection("chats")

        console.log("Pinged your deployment. You successfully connected to MongoDB! 🟢");

        const verifyJWT = (req, res, next) => {
            const token = req.headers.authorization?.split(" ")[1];
            if (!token) return res.status(401).json({ message: "Unauthorized" });

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) return res.status(403).json({ message: "Token expired or invalid" });
                req.user = decoded;
                next();
            });
        };

        const createTokens = (email) => ({
            accessToken: jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" }),
            refreshToken: jwt.sign({ email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" }),
        });

        app.post("/jwt", (req, res) => {
            const { email } = req.body;
            if (!email) return res.status(400).json({ message: "Email required" });

            const { accessToken, refreshToken } = createTokens(email);

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            res.json({ success: true, accessToken });
        });

        app.post("/refresh-token", (req, res) => {
            const refreshToken = req.cookies?.refreshToken;
            if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

            jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    res.clearCookie("refreshToken");
                    return res.status(401).json({ message: "Invalid refresh token" });
                }

                const { accessToken } = createTokens(decoded.email);
                res.json({ success: true, accessToken });
            });
        });

        app.post("/logout", (req, res) => {
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict"
            });
            res.json({ success: true });
        });





        app.post("/activeStatus", async (req, res) => {
            const userId = req.query.userId;
            if (!userId) return res.status(400).send("Something is wrong");
            const userObjectId = new ObjectId(userId);

            try {
                const user = await usersCollection.findOne({ _id: userObjectId });
                if (!user) return res.status(404).json({ message: "User not found" });

                const userKey = user._id.toString();

                if (!user.onlineStatus) {
                    await usersCollection.updateOne(
                        { _id: userObjectId },
                        { $set: { onlineStatus: true } }
                    );
                    console.log(`🟢 ${user.email} marked online`);
                }
                if (userTimers.has(userKey)) clearTimeout(userTimers.get(userKey));
                const timeout = setTimeout(async () => {
                    await usersCollection.updateOne(
                        { _id: userObjectId },
                        { $set: { onlineStatus: false } }
                    );
                    userTimers.delete(userKey);
                    console.log(`⛔ ${user.email} marked offline due to timeout`);
                }, 4000);
                userTimers.set(userKey, timeout);

                res.status(200).json({ status: "online" });

            } catch (error) {
                console.error("❌ activeStatus error:", error);
                res.status(500).json({ message: "Server error" });
            }
        });



        app.post("/signup", async (req, res) => {
            const formData = req.body;
            const user = await usersCollection.findOne({ email: formData.email })
            if (user) return res.send({ data: "User already existed" })
            const result = await usersCollection.insertOne(formData)
            if (result) res.send(formData)
        })
        app.post("/signinwithgoogle", async (req, res) => {
            const formData = req.body;
            const user = await usersCollection.findOne({ email: formData.email })
            if (user) return res.send(user)
            if (user == null) {
                const result = await usersCollection.insertOne(formData)
                if (result) res.send(user)
            }
        })
        app.post("/forgotPass", async (req, res) => {
            const { email } = req.body;
            const user = await usersCollection.findOne({ email })
            if (!user) return res.send({ message: "User not found" })
            return res.send({ message: "User found" })
        })
        app.post("/logout", (req, res) => {
            res.clearCookie("token", {
                httpOnly: true,
                secure: false,
                sameSite: "Lax"
            });
            res.json({ success: true });
        });




        app.get("/profile", async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) return res.status(400).json({ message: "Email is required" });
                const user = await usersCollection.aggregate([
                    { $match: { email } },

                    // posts populate
                    {
                        $lookup: {
                            from: "posts",
                            localField: "posts",
                            foreignField: "_id",
                            as: "posts"
                        }
                    },

                    // savePosts populate
                    {
                        $lookup: {
                            from: "posts",
                            localField: "savePosts",
                            foreignField: "_id",
                            as: "savePosts"
                        }
                    },

                    // myFriends populate
                    {
                        $lookup: {
                            from: "users",
                            localField: "myFriends",
                            foreignField: "_id",
                            as: "myFriends"
                        }
                    },

                    // friendRequests populate
                    {
                        $lookup: {
                            from: "users",
                            localField: "friendRequests",
                            foreignField: "_id",
                            as: "friendRequests"
                        }
                    },

                    // sentRequests populate
                    {
                        $lookup: {
                            from: "users",
                            localField: "sentRequests",
                            foreignField: "_id",
                            as: "sentRequests"
                        }
                    }
                ]).toArray();

                if (!user || !user.length) return res.status(404).json({ message: "User not found" });

                res.json(user[0]); // aggregate result array দেয়, তাই [0]
            } catch (err) {
                res.status(500).json({ message: "Server error", error: err.message });
            }
        });


        app.get("/updateInfo/:id", async (req, res) => {
            const userEmail = req.params.id;
            const user = await usersCollection.findOne({ email: userEmail })
            res.send(user)
        });
        app.put("/update", async (req, res) => {
            const { name, email, address, bio, profilephotourl, coverphotourl, phone, website } = req.body;
            const query = { email }
            const updatedUser = { $set: { name, address, bio, profilephotourl, coverphotourl, phone, website } }
            const result = await usersCollection.updateMany(query, updatedUser)
            res.send(result)
            return

        })
        app.put("/updateUsername", async (req, res) => {
            const { email, username } = req.body;
            const user = await usersCollection.findOne({ username: username })
            if (user == null) {
                const query = { email }
                const updatedUser = { $set: { username } }
                const result = await usersCollection.updateOne(query, updatedUser)
                res.send(result)
                return
            }
            if (username === user.username) {
                return res.send({ message: "This username already existed" })
            }
        })
        app.delete("/profile/delete/:email", async (req, res) => {
            const email = req.params.email;

            try {
                // Optional: Auth header check
                // if (req.headers.authorization !== process.env.ADMIN_SECRET) {
                //   return res.status(403).json({ error: "Unauthorized" });
                // }

                // Delete user
                const userResult = await usersCollection.deleteOne({ email });

                // Delete all posts
                const postsDeleted = await postsCollection.deleteMany({ authorEmail: email });

                // Delete all comments (fallback if collection doesn't exist)
                const commentsDeleted = commentsCollection
                    ? await commentsCollection.deleteMany({ authorEmail: email })
                    : { deletedCount: 0 };

                // Remove likes from all posts
                const likesRemoved = await postsCollection.updateMany(
                    {},
                    { $pull: { likes: { userEmail: email } } }
                );

                // Remove from other users' friend/request lists
                const friendsCleaned = await usersCollection.updateMany(
                    {},
                    {
                        $pull: {
                            friends: { email: email },
                            sentRequests: { email: email },
                            receivedRequests: { email: email },
                        },
                    }
                );

                res.status(200).send({
                    message: "✅ Account and related data deleted successfully",
                    userDeleted: userResult.deletedCount,
                    postsDeleted: postsDeleted.deletedCount,
                    commentsDeleted: commentsDeleted.deletedCount,
                    likesUpdated: likesRemoved.modifiedCount,
                    friendsCleaned: friendsCleaned.modifiedCount,
                });
            } catch (error) {
                console.error("❌ Error deleting account:", error);
                res.status(500).json({ error: "Server error during account deletion" });
            }
        });




        app.put("/user/make-admin/:email", async (req, res) => {
            const email = req.params.email;
            try {
                const filter = { email };
                const updateDoc = {
                    $set: { role: "admin" },
                };
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (err) {
                res.status(500).send({ message: "Failed to make admin", error: err });
            }
        });
        app.put("/user/remove-admin/:email", async (req, res) => {
            const email = req.params.email;
            try {
                const filter = { email };
                const updateDoc = {
                    $set: { role: "user" },
                };
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (err) {
                res.status(500).send({ message: "Failed to remove admin", error: err });
            }
        });
        app.post("/upload-profile", upload.single("profileImage"), async (req, res) => {
            try {
                if (!req.file) return res.status(400).send("No file uploaded");

                // Compress image using sharp
                const compressedBuffer = await sharp(req.file.buffer)
                    .resize(500)
                    .jpeg({ quality: 80 })
                    .toBuffer();

                // Convert to base64
                const base64Image = `data:${req.file.mimetype};base64,${compressedBuffer.toString("base64")}`;

                // Upload to imgbb
                const response = await axios.post(
                    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
                    {
                        image: base64Image.split(",")[1],
                    }
                );

                const imageUrl = response.data.data.url;
                const email = req.body.email;

                if (!email) return res.status(400).send("Email missing");

                // Save to MongoDB
                await usersCollection.updateOne(
                    { email },
                    { $set: { profileImage: imageUrl } },
                    { upsert: true }
                );

                res.json({ success: true, imageUrl });
            } catch (error) {
                console.error(error.message);
                res.status(500).send("Upload failed");
            }
        });



        app.get("/posts", async (req, res) => {
            try {
                const authorId = req.query.authorId;
                const query = authorId ? { authorId: new ObjectId(authorId) } : {}; // Filter if authorId exists

                const totalCount = await postsCollection.countDocuments(query);
                if (totalCount === 0) return res.send([]);

                const posts = await postsCollection.aggregate([
                    { $match: query },
                    { $sample: { size: totalCount } },
                    {
                        $lookup: {
                            from: "users",
                            localField: "authorId",
                            foreignField: "_id",
                            as: "authorInfo",
                        },
                    },
                    { $unwind: "$authorInfo" },
                    {
                        $lookup: {
                            from: "users",
                            localField: "likes",
                            foreignField: "_id",
                            as: "likesInfo",
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            content: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            shares: 1,
                            comments: 1,
                            author: {
                                _id: "$authorInfo._id",
                                name: "$authorInfo.name",
                                username: "$authorInfo.username",
                                profilePhotoUrl: "$authorInfo.profile.profilePhotoUrl",
                            },
                            likes: {
                                $map: {
                                    input: "$likesInfo",
                                    as: "user",
                                    in: {
                                        _id: "$$user._id",
                                        name: "$$user.name",
                                        username: "$$user.username",
                                        profilePhotoUrl: "$$user.profile.profilePhotoUrl", // fixed casing
                                    },
                                },
                            },
                        },
                    },
                ]).toArray();

                res.send(posts);
            } catch (error) {
                console.error("Error getting posts:", error);
                res.status(500).send("Failed to fetch posts");
            }
        });
        app.get("/post/:id", async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid post ID" });
                }

                const postObjectId = new ObjectId(id);
                const post = await postsCollection.aggregate([
                    { $match: { _id: postObjectId } },

                    // Join with author info
                    {
                        $lookup: {
                            from: "users",
                            localField: "authorId",
                            foreignField: "_id",
                            as: "authorInfo",
                        },
                    },
                    { $unwind: "$authorInfo" },
                    {
                        $lookup: {
                            from: "users",
                            localField: "likes",
                            foreignField: "_id",
                            as: "likesInfo",
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            content: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            shares: 1,
                            comments: 1,
                            author: {
                                _id: "$authorInfo._id",
                                name: "$authorInfo.name",
                                username: "$authorInfo.username",
                                profilePhotoUrl: "$authorInfo.profile.profilePhotoUrl",
                            },
                            likes: {
                                $map: {
                                    input: "$likesInfo",
                                    as: "user",
                                    in: {
                                        _id: "$$user._id",
                                        name: "$$user.name",
                                        username: "$$user.username",
                                        profilePhotoUrl: "$$user.profile.profilePhotoUrl",
                                    },
                                },
                            },
                        },
                    },
                ]).toArray();

                if (!post || post.length === 0) {
                    return res.status(404).json({ message: "Post not found" });
                }

                res.status(200).json(post[0]);
            } catch (error) {
                console.error("Error fetching post:", error);
                res.status(500).json({ message: "Failed to fetch post" });
            }
        });
        app.get("/savedPosts", async (req, res) => {
            try {
                const { userId } = req.query;

                if (!userId) return res.status(400).send("userId is required");

                const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
                if (!user) return res.status(404).send("User not found");

                const savedPostIds = (user.savePosts || []).map(id => new ObjectId(id));
                if (savedPostIds.length === 0) return res.send([]);

                const savedPosts = await postsCollection.aggregate([
                    { $match: { _id: { $in: savedPostIds } } },
                    { $sort: { createdAt: -1 } },
                    {
                        $lookup: {
                            from: "users",
                            localField: "authorId",
                            foreignField: "_id",
                            as: "authorInfo",
                        },
                    },
                    { $unwind: "$authorInfo" },
                    {
                        $lookup: {
                            from: "users",
                            localField: "likes",
                            foreignField: "_id",
                            as: "likesInfo",
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            content: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            shares: 1,
                            comments: 1,
                            author: {
                                _id: "$authorInfo._id",
                                name: "$authorInfo.name",
                                username: "$authorInfo.username",
                                profilePhotoUrl: "$authorInfo.profile.profilePhotoUrl", // ✅ fixed path
                            },
                            likes: {
                                $map: {
                                    input: "$likesInfo",
                                    as: "user",
                                    in: {
                                        _id: "$$user._id",
                                        name: "$$user.name",
                                        username: "$$user.username",
                                        profilePhotoUrl: "$$user.profile.profilePhotoUrl", // ✅ fixed path
                                    },
                                },
                            },
                        },
                    },
                ]).toArray();

                res.send(savedPosts);
            } catch (err) {
                console.error("Error fetching saved posts:", err);
                res.status(500).send("Failed to fetch saved posts");
            }
        });



        app.put("/savePost", async (req, res) => {

            try {
                const { userId, postId } = req.body;
                if (!userId || !postId) return res.status(400).json({ message: "Missing userId or postId" });

                const userObjId = new ObjectId(userId);
                const postObjId = new ObjectId(postId);

                const user = await usersCollection.findOne({ _id: userObjId });
                const post = await postsCollection.findOne({ _id: postObjId });

                if (!user) return res.status(404).json({ message: "User not found" });
                if (!post) return res.status(404).json({ message: "Post not found" });

                await usersCollection.updateOne(
                    { _id: userObjId },
                    { $addToSet: { savePosts: postObjId } }
                );

                res.status(200).json({ message: "Post saved successfully" });

            } catch (error) {
                console.error("Error in /savePost route:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });
        app.put("/removeSavedPost", async (req, res) => {
            const { userId, postId } = req.body;
            if (!userId || !postId) return res.status(400).send("Missing userId or postId");

            const userObjId = new ObjectId(userId);
            const postObjId = new ObjectId(postId);

            const user = await usersCollection.findOne({ _id: userObjId });
            const post = await postsCollection.findOne({ _id: postObjId });

            if (!user) return res.status(404).json({ message: "User not found" });
            if (!post) return res.status(404).json({ message: "Post not found" });

            try {
                await usersCollection.updateOne(
                    { _id: userObjId },
                    { $pull: { savePosts: postObjId } }
                );
                res.status(200).json({ message: "Saved post removed successfully" });
            } catch (error) {
                console.error("Error removing saved post:", error);
                res.status(500).send("Server error");
            }
        });



        app.put("/post/like/:id", async (req, res) => {
            const { userId } = req.body; // frontend থেকে আসবে string
            const postId = req.params.id;

            try {
                const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
                if (!post) return res.status(404).json({ message: "Post not found" });

                const userObjectId = new ObjectId(userId);

                const alreadyLiked = post.likes?.some(
                    (id) => id.toString() === userId // ObjectId compare
                );

                let updateResult;
                if (alreadyLiked) {
                    // Dislike
                    updateResult = await postsCollection.updateOne(
                        { _id: new ObjectId(postId) },
                        { $pull: { likes: userObjectId } }
                    );
                    return res.status(200).json({ message: "Disliked", result: updateResult });
                } else {
                    // Like
                    updateResult = await postsCollection.updateOne(
                        { _id: new ObjectId(postId) },
                        { $addToSet: { likes: userObjectId } } // duplicate না হবে
                    );
                    return res.status(200).json({ message: "Liked", result: updateResult });
                }
            } catch (error) {
                console.error("Error in like route:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
        });
        app.post("/post", async (req, res) => {
            const postData = req.body;
            const existingPost = await postsCollection.findOne({ postImageUrl: postData.postImageUrl });
            if (existingPost) return res.status(409).send("This Image URL was already taken");

            const result = await postsCollection.insertOne(postData);

            const newPostId = result.insertedId;
            const userEmail = postData.authorEmail;
            const userUpdateResult = await usersCollection.updateOne({ email: userEmail }, { $push: { posts: newPostId } });

            const data = { result, userUpdateResult }
            res.send(data)

        });

        app.get("/post/update/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postsCollection.findOne({ _id: new ObjectId(id) })
            res.send(post)
        })
        app.put("/post/update/:id", async (req, res) => {
            const { postImageUrl, postContent, lastUpdateDate } = req.body;
            const id = req.params.id;
            const post = await postsCollection.findOne({ _id: new ObjectId(id) })
            const query = { postImageUrl }
            const updatedPost = { $set: { postContent, lastUpdateDate } }
            const result = await postsCollection.updateMany(query, updatedPost)
            res.send(result)
            // console.log(result)
        })
        app.delete("/post/delete/:id", async (req, res) => {
            const postId = req.params.id;
            try {
                const query = { _id: new ObjectId(postId) };
                const post = await postsCollection.findOne(query);

                if (!post) return res.status(404).send({ message: "Post not found." });

                const authorEmail = post.authorEmail;
                if (!authorEmail) console.warn(`Post ${postId} does not have an authorEmail. Cannot update user's posts array.`);

                let userUpdateSuccess = false;
                if (authorEmail) {
                    try {
                        const userUpdateResult = await usersCollection.updateOne(
                            { email: authorEmail },
                            { $pull: { posts: post._id } }
                        );
                        if (userUpdateResult.modifiedCount > 0) {
                            userUpdateSuccess = true;
                        } else {
                        }
                    } catch (updateError) {
                        console.error(`Error updating user ${authorEmail}'s posts array:`, updateError);
                    }
                }
                const deleteResult = await postsCollection.deleteOne(query);
                if (deleteResult.deletedCount === 0) {
                    return res.status(500).send({ message: "Failed to delete post from database." });
                }
                res.send(deleteResult)
            } catch (error) {
                res.status(500).send({ message: "An internal server error occurred." });
            }
        });




        // Friends Related Apis
        app.get("/profile/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const userId = new ObjectId(id);

                // Step 1: Friend/User info
                const friend = await usersCollection.findOne({ _id: userId });
                if (!friend) return res.status(404).send({ message: "User not found" });

                // Step 2: Query posts of that user
                const query = { authorId: userId };

                const totalCount = await postsCollection.countDocuments(query);
                if (totalCount === 0)
                    return res.send({ friend, friendPost: [] });

                // Step 3: Aggregate posts with author & likes info
                const posts = await postsCollection
                    .aggregate([
                        { $match: query },
                        { $sort: { createdAt: -1 } },
                        {
                            $lookup: {
                                from: "users",
                                localField: "authorId",
                                foreignField: "_id",
                                as: "authorInfo",
                            },
                        },
                        { $unwind: "$authorInfo" },
                        {
                            $lookup: {
                                from: "users",
                                localField: "likes",
                                foreignField: "_id",
                                as: "likesInfo",
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                content: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                shares: 1,
                                comments: 1,
                                author: {
                                    _id: "$authorInfo._id",
                                    name: "$authorInfo.name",
                                    username: "$authorInfo.username",
                                    profilePhotoUrl: "$authorInfo.profile.profilePhotoUrl",
                                },
                                likes: {
                                    $map: {
                                        input: "$likesInfo",
                                        as: "user",
                                        in: {
                                            _id: "$$user._id",
                                            name: "$$user.name",
                                            username: "$$user.username",
                                            profilePhotoUrl: "$$user.profile.profilePhotoUrl",
                                        },
                                    },
                                },
                            },
                        },
                    ])
                    .toArray();

                res.send({
                    friend,
                    friendPost: posts,
                });
            } catch (error) {
                console.error("Error in /profile/:id:", error);
                res.status(500).send({ message: "Internal server error" });
            }
        });




        app.get("/allUsers", async (req, res) => {
            try {
                const userId = req.query.userId;
                if (!userId) return res.status(400).send("Somethings is wrong");

                const userObjectId = new ObjectId(userId)

                const allUsersExceptMe = await usersCollection.find({
                    _id: { $ne: userObjectId }
                }).toArray();

                res.send(allUsersExceptMe);
            } catch (error) {
                console.error("Error in /allfriends route:", error);
                res.status(500).send("Server error");
            }
        });

        app.get("/myfriends", async (req, res) => {
            const userId = req.query.userId;
            if (!userId) return res.status(400).send("Somethings is wrong");

            const userObjectId = new ObjectId(userId)

            try {
                const user = await usersCollection.findOne({ _id: userObjectId });
                if (!user) return res.status(404).send("User not found");

                const friendIds = (user.myFriends || []).map(id => new ObjectId(id));
                if (friendIds.length === 0) return res.send([]);

                const friends = await usersCollection.find({ _id: { $in: friendIds } }).toArray();
                res.send(friends);

            } catch (error) {
                console.error("Error in /myfriends route:", error);
                res.status(500).send("Server error");
            }
        });
        app.get("/requests", async (req, res) => {
            const userId = req.query.userId;
            if (!userId) return res.status(400).send("Somethings is wrong");

            const userObjectId = new ObjectId(userId)
            try {
                const user = await usersCollection.findOne({ _id: userObjectId });
                if (!user) return res.status(404).send("User not found");

                const requestIds = (user.friendRequests || []).map(id => new ObjectId(id));
                if (requestIds.length === 0) return res.send([]);

                const requests = await usersCollection.find({ _id: { $in: requestIds } }).toArray();
                res.send(requests);

            } catch (error) {
                console.error("Error in /requests route:", error);
                res.status(500).send("Server error");
            }
        });
        app.get("/sentrequest", async (req, res) => {
            const userId = req.query.userId;
            if (!userId) return res.status(400).send("Somethings is wrong");

            const userObjectId = new ObjectId(userId)
            try {
                const user = await usersCollection.findOne({ _id: userObjectId });
                if (!user) return res.status(404).send("User not found");
                const sentRequestIds = (user.sentRequests || []).map(id => new ObjectId(id));
                if (sentRequestIds.length === 0) return res.send([]);
                const sentRequests = await usersCollection.find({ _id: { $in: sentRequestIds } }).toArray();
                res.send(sentRequests);
            } catch (error) {
                console.error("Error in /sentrequest route:", error);
                res.status(500).send("Server error");
            }
        });
        app.get("/youMayKnow", async (req, res) => {
            const userId = req.query.userId;
            if (!userId) return res.status(400).send("Somethings is wrong");

            const userObjectId = new ObjectId(userId)
            try {
                const user = await usersCollection.findOne({ _id: userObjectId });
                if (!user) return res.status(404).send("User not found");

                const allUsers = await usersCollection.find().toArray();

                const myIdStr = user._id.toString();
                const friendIds = (user.myFriends || []).map(id => id.toString());
                const requestIds = (user.friendRequests || []).map(id => id.toString());
                const sentRequestIds = (user.sentRequests || []).map(id => id.toString());

                const youMayKnow = allUsers.filter(u => {
                    const uIdStr = u._id.toString();
                    return (
                        uIdStr !== myIdStr &&
                        !friendIds.includes(uIdStr) &&
                        !requestIds.includes(uIdStr) &&
                        !sentRequestIds.includes(uIdStr)
                    );
                });
                res.send(youMayKnow);
            } catch (error) {
                console.error("Error in /youMayKnow route:", error);
                res.status(500).send("Server error");
            }
        });


        // Add friend request / cancel
        app.put("/addfriend", async (req, res) => {
            try {
                const { userId, friendId } = req.body;
                if (!userId || !friendId) return res.status(400).send("Invalid payload");

                const userObjId = new ObjectId(userId);
                const friendObjId = new ObjectId(friendId);

                // Check if already sent (optional, can skip for idempotency)
                const friend = await usersCollection.findOne({ _id: friendObjId });
                const alreadySent = friend?.friendRequests?.some(id => id.equals(userObjId));
                if (alreadySent) return res.status(409).json({ message: "Already sent request" });

                // Send request
                await usersCollection.updateOne(
                    { _id: friendObjId },
                    { $addToSet: { friendRequests: userObjId } }
                );
                await usersCollection.updateOne(
                    { _id: userObjId },
                    { $addToSet: { sentRequests: friendObjId } }
                );

                return res.json({ message: "Request sent" });

            } catch (error) {
                console.error("Add friend error:", error);
                return res.status(500).send("Server error");
            }
        });
        app.put("/cancelreceivedrequest", async (req, res) => {
            const { userId, friendId } = req.body;
            const userObjId = new ObjectId(userId);
            const friendObjId = new ObjectId(friendId);

            await usersCollection.updateOne(
                { _id: userObjId },
                { $pull: { friendRequests: friendObjId } }
            );
            await usersCollection.updateOne(
                { _id: friendObjId },
                { $pull: { sentRequests: userObjId } }
            );

            res.json({ message: "Received request declined" });
        });
        app.put("/cancelsentrequest", async (req, res) => {
            const { userId, friendId } = req.body;
            const userObjId = new ObjectId(userId);
            const friendObjId = new ObjectId(friendId);

            await usersCollection.updateOne(
                { _id: userObjId },
                { $pull: { sentRequests: friendObjId } }
            );
            await usersCollection.updateOne(
                { _id: friendObjId },
                { $pull: { friendRequests: userObjId } }
            );

            res.json({ message: "Sent request canceled" });
        });
        app.put("/confirmFriend", async (req, res) => {
            const { userId, friendId } = req.body;
            if (!userId || !friendId) return res.status(400).json({ message: "Missing IDs" });

            try {
                const userObjId = new ObjectId(userId);
                const friendObjId = new ObjectId(friendId);

                const user = await usersCollection.findOne({ _id: userObjId });
                const friend = await usersCollection.findOne({ _id: friendObjId });

                if (!user || !friend) return res.status(404).json({ message: "User or Friend not found" });

                // Check if the request exists
                const hasRequest = user.friendRequests?.some(id => id.equals(friendObjId));
                if (!hasRequest) return res.status(400).json({ message: "No friend request found" });

                // Remove friendId from user's friendRequests
                await usersCollection.updateOne(
                    { _id: userObjId },
                    { $pull: { friendRequests: friendObjId } }
                );

                // Add friendId to user's myFriends
                await usersCollection.updateOne(
                    { _id: userObjId },
                    { $addToSet: { myFriends: friendObjId } }
                );

                // Remove userId from friend's sentRequests
                await usersCollection.updateOne(
                    { _id: friendObjId },
                    { $pull: { sentRequests: userObjId } }
                );

                // Add userId to friend's myFriends
                await usersCollection.updateOne(
                    { _id: friendObjId },
                    { $addToSet: { myFriends: userObjId } }
                );

                return res.status(200).json({ message: "Request accepted" });

            } catch (error) {
                console.error("Error in /confirmFriend route:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
        });
        app.put("/unfriend", async (req, res) => {
            try {
                const { userId, friendId } = req.body;
                if (!userId || !friendId) return res.status(400).send("Invalid payload");

                const userObjId = new ObjectId(userId);
                const friendObjId = new ObjectId(friendId);

                const user = await usersCollection.findOne({ _id: userObjId });
                const friend = await usersCollection.findOne({ _id: friendObjId });

                if (!user || !friend) return res.status(404).send("User or Friend not found");

                await usersCollection.updateOne(
                    { _id: userObjId },
                    { $pull: { myFriends: friendObjId } }
                );

                await usersCollection.updateOne(
                    { _id: friendObjId },
                    { $pull: { myFriends: userObjId } }
                );

                return res.status(200).json({ message: "Unfriend successful" });

            } catch (error) {
                console.error("Unfriend error:", error);
                res.status(500).send("Server error");
            }
        });






        app.get('/search', async (req, res) => {
            try {
                const query = req.query.q || '';
                if (!query.trim()) {
                    return res.json({ posts: [], users: [] });
                }

                console.log(query)

                const email = req.query.email;
                if (!email) return res.status(400).send("Email missing");

                const limit = parseInt(req.query.limit) || 10;

                const regex = new RegExp(query, 'i');

                const posts = await postsCollection
                    .find({ postContent: { $regex: regex } })
                    .limit(limit)
                    .toArray();

                const users = await usersCollection
                    .find({
                        $and: [
                            {
                                $or: [
                                    { name: { $regex: regex } },
                                    { email: { $regex: regex } }
                                ]
                            },
                            { email: { $ne: email } }
                        ]
                    })
                    .limit(limit)
                    .toArray();
                console.log(posts)
                console.log(users)
                res.json({ posts, users });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Server Error' });
            }
        });


        app.get("/message/:id", async (req, res) => {
            try {
                const friendId = new ObjectId(req.params.id);
                const userId = new ObjectId(req.query.userId);

                // Step 1: Friend info
                const friend = await usersCollection.findOne(
                    { _id: friendId },
                    {
                        projection: {
                            _id: 1,
                            name: 1,
                            username: 1,
                            profile: { profilePhotoUrl: 1 },
                            onlineStatus: 1,
                        },
                    }
                );

                if (!friend) return res.status(404).send({ message: "Friend not found" });

                // Step 2: ChatRoom find
                const chatRoom = await chatRoomsCollection.findOne({
                    participants: { $all: [userId, friendId] },
                });

                if (!chatRoom) {
                    return res.send({
                        friend,
                        messages: [],
                    });
                }

                // Step 3: Message IDs
                const messageIds = chatRoom.messages.map((m) => new ObjectId(m.messageId));

                // Step 4: Fetch messages
                let messages = await chatsCollection
                    .find({ _id: { $in: messageIds } })
                    .sort({ createdAt: 1 })
                    .toArray();

                // Step 5: Populate sender and receiver info
                const userIds = [...new Set(messages.flatMap(m => [m.senderId.toString(), m.receiverId.toString()]))]
                    .map(id => new ObjectId(id));

                const users = await usersCollection
                    .find({ _id: { $in: userIds } })
                    .project({ _id: 1, name: 1, username: 1, "profile.profilePhotoUrl": 1 })
                    .toArray();

                const usersMap = {};
                users.forEach(u => {
                    usersMap[u._id.toString()] = u;
                });

                messages = messages.map(msg => ({
                    ...msg,
                    sender: usersMap[msg.senderId.toString()],
                    receiver: usersMap[msg.receiverId.toString()],
                }));

                res.send({
                    friend,
                    messages,
                });
            } catch (error) {
                console.error("Error fetching messages:", error);
                res.status(500).send("Failed to fetch messages");
            }
        });

        app.post("/message/send", async (req, res) => {
            try {
                const { senderId, receiverId, message } = req.body;

                const sender = new ObjectId(senderId);
                const receiver = new ObjectId(receiverId);

                // 1️⃣ Step: message save করো
                const messageData = {
                    senderId: sender,
                    receiverId: receiver,
                    message,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                const messageResult = await chatsCollection.insertOne(messageData);
                const messageId = messageResult.insertedId;

                // 2️⃣ Step: chatRoomsCollection এ pair check করো
                const existingChatRoom = await chatRoomsCollection.findOne({
                    participants: { $all: [sender, receiver] },
                });

                const messageRef = {
                    messageId,
                    sentAt: messageData.createdAt,
                };

                if (existingChatRoom) {
                    // pair already exists → শুধু messageRef push করো
                    await chatRoomsCollection.updateOne(
                        { _id: existingChatRoom._id },
                        {
                            $push: { messages: messageRef },
                            $set: { lastUpdated: new Date() },
                        }
                    );
                } else {
                    // নতুন conversation তৈরি করো
                    await chatRoomsCollection.insertOne({
                        participants: [sender, receiver],
                        messages: [messageRef],
                        lastUpdated: new Date(),
                    });
                }

                res.status(200).send({
                    success: true,
                    message: "Message sent successfully",
                    messageId,
                });
            } catch (error) {
                console.error("Error sending message:", error);
                res.status(500).send("Failed to send message");
            }
        });

 
        app.delete("/message/:id", async (req, res) => {
            try {
                const msgId = new ObjectId(req.params.id);
                await chatsCollection.deleteOne({ _id: msgId });
                res.send({ success: true });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Failed to delete message" });
            }
        });
 
        app.put("/message/:id", async (req, res) => {
            try {
                const msgId = new ObjectId(req.params.id);
                const { message } = req.body;
                await chatsCollection.updateOne(
                    { _id: msgId },
                    { $set: { message, updatedAt: new Date() } }
                );
                res.send({ success: true });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Failed to update message" });
            }
        });







    }

    finally { }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("XENON MEDIA v2 MONGO_ATLAS 🟢 ON");
})


app.listen(port, () => {
    console.log('MONGO_ATLAS 🟢 ON', port);
})

module.exports = app;



