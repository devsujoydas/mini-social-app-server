const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
var cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require("dotenv").config()
const multer = require("multer");
const sharp = require("sharp");
const axios = require("axios");

const app = express()
const port = process.env.PORT || 3000

const storage = multer.memoryStorage();
const upload = multer({ storage });


app.use(cors({
    origin: ['https://xenonmedia.netlify.app', 'http://localhost:5173', "https://xenonmedia.vercel.app"],
    credentials: true
}));

app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f1vo05q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // await client.connect();
        const usersCollection = client.db("mini-social-app").collection("users")
        const postsCollection = client.db("mini-social-app").collection("posts")
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const verifyToken = async (req, res, next) => {
            const token = req.cookies?.token;
            if (!token) return res.status(401).send({ message: "Unauthorized access" })
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "Unauthorized access" })
                }
                req.user = decoded
                next()
            })
        }
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.cookie("token", token, {
                httpOnly: true,
                // secure: true,
                secure: false,
                sameSite: "Lax",
                maxAge: 24 * 60 * 60 * 1000
            });
            res.send({ success: true });

        })
        app.post("/activeStatus", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).json({ message: "Email is required" });
            try {
                // 🟢 
                const user = await usersCollection.findOne({ email: email });
                if (!user) return res.status(404).json({ message: "User not found" });
                if (!user.onlineStatus) {
                    await usersCollection.updateOne({ email: email }, { $set: { onlineStatus: true } });
                    console.log(`🟢 ${email} marked online`);
                }
                if (userTimers.has(email)) { clearTimeout(userTimers.get(email)); }
                const timeout = setTimeout(async () => {
                    await usersCollection.updateOne({ email: email }, { $set: { onlineStatus: false } });
                    userTimers.delete(email);
                    console.log(`⛔ ${email} marked offline due to timeout`);
                }, 4000);
                userTimers.set(email, timeout);
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
                // secure: false,
                secure: true,
            });
            res.status(200).json({ message: "Logged out successfully" });
        });


        // User Related Apis
        app.get("/profile/:id", async (req, res) => {
            const userEmail = req.params.id;
            const user = await usersCollection.findOne({ email: userEmail })
            res.send(user)
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
        // DELETE user + all related data
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


        // ✅ Make Admin
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

        // ✅ Remove Admin
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



        // Upload
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





        // Post Related Apis
        app.get("/posts", async (req, res) => {
            try {
                const posts = await postsCollection.aggregate([
                    { $sample: { size: await postsCollection.countDocuments() } }
                ]).toArray();
                res.send(posts);
            } catch (error) {
                console.error("Error getting random posts:", error);
                res.status(500).send("Failed to fetch random posts");
            }
        });

        app.get("/post/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postsCollection.findOne({ _id: new ObjectId(id) })
            res.send(post)
        });

        app.get("/profile/post/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postsCollection.findOne({ _id: new ObjectId(id) })
            res.send(post)
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



        app.put("/post/like/:id", async (req, res) => {
            const { userId } = req.body;
            const postId = req.params.id;

            try {
                const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
                if (!post) return res.status(404).json({ message: "Post not found" });

                const alreadyLiked = post.likes?.includes(userId);

                let updateResult;
                if (alreadyLiked) {
                    updateResult = await postsCollection.updateOne(
                        { _id: new ObjectId(postId) },
                        { $pull: { likes: userId } }
                    );
                    return res.status(200).json({ message: "Disliked", result: updateResult });
                } else {
                    updateResult = await postsCollection.updateOne(
                        { _id: new ObjectId(postId) },
                        { $addToSet: { likes: userId } } //addToSet duplicate jeno na hoy se jonno use korchi
                    );
                    return res.status(200).json({ message: "Liked", result: updateResult });
                }
            } catch (error) {
                console.error("Error in like route:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
        });


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
        app.get("/message/:id", async (req, res) => {
            const username = req.params.id;

            // Username diye friend user khuja
            const friend = await usersCollection.findOne({ username });

            // Sob post nia aschi
            const posts = await postsCollection.find().toArray();

            // Sei friend er post gula filter korchi
            const friendPost = posts.filter(post => post.authorUsername === friend.username);

            // friend ar tar post response hishebe pathacchi
            const data = { friend, friendPost };

            res.send(data);
        });



        // Friends Related Apis
        app.get("/allfriends", async (req, res) => {
            try {
                const email = req.query.email;
                if (!email) return res.status(400).send("Email missing");

                // Sob user paoa jabe, jar email tumar email na
                const allUsersExceptMe = await usersCollection.find({
                    email: { $ne: email }
                }).toArray();

                res.send(allUsersExceptMe);
            } catch (error) {
                console.error("Error in /allfriends route:", error);
                res.status(500).send("Server error");
            }
        });
        app.get("/friends/:id", async (req, res) => {
            const username = req.params.id;

            // User ke username diye khuje ber korchi
            const friend = await usersCollection.findOne({ username });

            // Sob post nia aschi
            const posts = await postsCollection.find().toArray();

            // Sei friend er username er post gula filter korchi
            const friendPost = posts.filter(post => post.authorUsername === friend.username);

            // friend ar tar posts ak sathe pathacchi
            const data = { friend, friendPost };

            res.send(data);
        });
        // Get my friends with full objects
        app.get("/myfriends", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");

            try {
                const user = await usersCollection.findOne({ email });
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
        // Get friend requests with full objects
        app.get("/requests", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");

            try {
                const user = await usersCollection.findOne({ email });
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
        // Get sent friend requests with full objects
        app.get("/sentrequest", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");
            try {
                const user = await usersCollection.findOne({ email });
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
        // Get users you may know (exclude self, friends, requests, sent)
        app.get("/youMayKnow", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");

            try {
                const user = await usersCollection.findOne({ email });
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
        // CencelAddFriend
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


        // Confirm friend request
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
        // Unfriend
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


        // Get saved posts for user
        app.get("/savedPosts", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");

            try {
                const user = await usersCollection.findOne({ email });
                if (!user) return res.status(404).send("User not found");

                const savedPostIds = (user.savePosts || []).map(id => new ObjectId(id));
                if (savedPostIds.length === 0) return res.send([]);

                const savedPosts = await postsCollection.find({ _id: { $in: savedPostIds } }).toArray();
                res.send(savedPosts);

            } catch (error) {
                console.error("Error in /savedPosts route:", error);
                res.status(500).send("Server error");
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





        app.get('/search', async (req, res) => {
            try {
                const query = req.query.q || '';
                if (!query.trim()) {
                    return res.json({ posts: [], users: [] });
                }

                const email = req.query.email;
                if (!email) return res.status(400).send("Email missing");

                const limit = parseInt(req.query.limit) || 10;

                const regex = new RegExp(query, 'i');

                // পোস্ট সার্চ (postContent)
                const posts = await postsCollection
                    .find({ postContent: { $regex: regex } })
                    .limit(limit)
                    .toArray();

                // ইউজার সার্চ (name অথবা email মিলে এবং নিজের email বাদ)
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

                res.json({ posts, users });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Server Error' });
            }
        });







    }

    finally { }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("XENON MEDIA v2");
})


app.listen(port, () => {
    console.log(port);
})

module.exports = app;




