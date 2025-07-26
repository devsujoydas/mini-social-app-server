const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
var cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require("dotenv").config()

const app = express()
const port = process.env.PORT || 3000


app.use(cors({
    // origin: 'http://localhost:5173',
    // origin: 'https://xenonmedia.netlify.app',
    origin: ['https://xenonmedia.netlify.app', 'http://localhost:5173'],
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
        const userModel = client.db("mini-social-app").collection("users")
        const postModel = client.db("mini-social-app").collection("posts")
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
                const user = await userModel.findOne({ email: email });
                if (!user) return res.status(404).json({ message: "User not found" });
                if (!user.onlineStatus) {
                    await userModel.updateOne({ email: email }, { $set: { onlineStatus: true } });
                    console.log(`🟢 ${email} marked online`);
                }
                if (userTimers.has(email)) { clearTimeout(userTimers.get(email)); }
                const timeout = setTimeout(async () => {
                    await userModel.updateOne({ email: email }, { $set: { onlineStatus: false } });
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
            const user = await userModel.findOne({ email: formData.email })
            if (user) return res.send({ data: "User already existed" })
            const result = await userModel.insertOne(formData)
            if (result) res.send(formData)
        })
        app.post("/signinwithgoogle", async (req, res) => {
            const formData = req.body;

            const user = await userModel.findOne({ email: formData.email })
            if (user) return res.send(user)

            if (user == null) {
                const result = await userModel.insertOne(formData)
                if (result) res.send(user)
            }
        })
        app.post("/forgotPass", async (req, res) => {
            const { email } = req.body;
            const user = await userModel.findOne({ email })
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
            const user = await userModel.findOne({ email: userEmail })
            res.send(user)
        });
        app.get("/updateInfo/:id", async (req, res) => {
            const userEmail = req.params.id;
            const user = await userModel.findOne({ email: userEmail })
            res.send(user)
        });
        app.put("/update", async (req, res) => {
            const { name, email, address, bio, profilephotourl, coverphotourl, phone, website } = req.body;
            const query = { email }
            const updatedUser = { $set: { name, address, bio, profilephotourl, coverphotourl, phone, website } }
            const result = await userModel.updateMany(query, updatedUser)
            res.send(result)
            return

        })
        app.put("/updateUsername", async (req, res) => {
            const { email, username } = req.body;
            const user = await userModel.findOne({ username: username })
            if (user == null) {
                const query = { email }
                const updatedUser = { $set: { username } }
                const result = await userModel.updateOne(query, updatedUser)
                res.send(result)
                return
            }
            if (username === user.username) {
                return res.send({ message: "This username already existed" })
            }
        })
        app.delete("/profile/delete/:id", async (req, res) => {
            const email = req.params.id;
            const query = { email: email }
            const result = await userModel.deleteOne(query)
            res.send(result)
        })


        // Post Related Apis
        app.get("/posts", async (req, res) => {
            try {
                const posts = await postModel.aggregate([
                    { $sample: { size: await postModel.countDocuments() } }
                ]).toArray();
                res.send(posts);
            } catch (error) {
                console.error("Error getting random posts:", error);
                res.status(500).send("Failed to fetch random posts");
            }
        });
        app.get("/post/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postModel.findOne({ _id: new ObjectId(id) })
            res.send(post)
        });
        app.get("/profile/post/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postModel.findOne({ _id: new ObjectId(id) })
            res.send(post)
        });
        app.post("/post", async (req, res) => {
            const postData = req.body;
            const existingPost = await postModel.findOne({ postImageUrl: postData.postImageUrl });
            if (existingPost) return res.status(409).send("This Image URL was already taken");

            const result = await postModel.insertOne(postData);

            const newPostId = result.insertedId;
            const userEmail = postData.authorEmail;
            const userUpdateResult = await userModel.updateOne({ email: userEmail }, { $push: { posts: newPostId } });

            const data = { result, userUpdateResult }
            res.send(data)

        });
        app.get("/post/update/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postModel.findOne({ _id: new ObjectId(id) })
            res.send(post)
        })
        app.put("/post/update/:id", async (req, res) => {
            const { postImageUrl, postContent, lastUpdateDate } = req.body;
            const id = req.params.id;
            const post = await postModel.findOne({ _id: new ObjectId(id) })
            const query = { postImageUrl }
            const updatedPost = { $set: { postContent, lastUpdateDate } }
            const result = await postModel.updateMany(query, updatedPost)
            res.send(result)
            // console.log(result)
        })
        app.put("/post/like/:id", async (req, res) => {
            const { name, username, userId } = req.body;
            const postId = req.params.id;

            try {
                const post = await postModel.findOne({ _id: new ObjectId(postId) });
                if (!post) return res.status(404).json({ message: "Post not found" });

                // Check if this user already liked
                const likedUser = post.likes.find(like => like.userId === userId);

                if (likedUser) {
                    // Dislike (remove from likes array)
                    const postDislikedUpdateResult = await postModel.updateOne(
                        { _id: new ObjectId(postId) },
                        { $pull: { likes: { userId: userId } } }
                    );
                    // console.log("Disliked successfully", postDislikedUpdateResult);
                    return res.status(200).json({ message: "Disliked", result: postDislikedUpdateResult });

                } else {
                    // Like (add to likes array)
                    const postlikedUpdateResult = await postModel.updateOne(
                        { _id: new ObjectId(postId) },
                        { $push: { likes: { userId, name, username } } }
                    );
                    // console.log("Liked successfully", postlikedUpdateResult);
                    return res.status(200).json({ message: "Liked", result: postlikedUpdateResult });
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
                const post = await postModel.findOne(query);
                if (!post) {
                    return res.status(404).send({ message: "Post not found." });
                }
                const authorEmail = post.authorEmail;
                if (!authorEmail) {
                    console.warn(`Post ${postId} does not have an authorEmail. Cannot update user's posts array.`);
                }
                let userUpdateSuccess = false;
                if (authorEmail) {
                    try {
                        const userUpdateResult = await userModel.updateOne(
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
                const deleteResult = await postModel.deleteOne(query);
                if (deleteResult.deletedCount === 0) {
                    return res.status(500).send({ message: "Failed to delete post from database." });
                }
                res.send(deleteResult)
            } catch (error) {
                res.status(500).send({ message: "An internal server error occurred." });
            }
        });


        // Friend related routes
        app.put("/addfriend", async (req, res) => {
            try {
                const { userId, friendId } = req.body;
                if (!userId || !friendId) return res.status(400).send("Invalid payload");

                const userObjId = new ObjectId(userId);
                const friendObjId = new ObjectId(friendId);

                const user = await userModel.findOne({ _id: userObjId });
                const friend = await userModel.findOne({ _id: friendObjId });

                if (!user || !friend) {
                    return res.status(404).json({ message: "User or Friend not found" });
                }

                // Check if friend already has a request from user
                const alreadyRequested = friend.friendRequests?.some(
                    (req) => req._id.toString() === userId
                );

                if (alreadyRequested) {
                    await userModel.updateOne(
                        { _id: friendObjId },
                        { $pull: { friendRequests: { _id: userObjId } } }
                    );
                    await userModel.updateOne(
                        { _id: userObjId },
                        { $pull: { sentRequests: { _id: friendObjId } } }
                    );
                    return res.json({ message: "Friend request canceled" });

                } else {
                    // Prepare requestData object
                    const requestDataForFriend = {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        username: user.username,
                        profilephotourl: user.profilephotourl,
                    };

                    const requestDataForUser = {
                        _id: friend._id,
                        name: friend.name,
                        email: friend.email,
                        username: friend.username,
                        profilephotourl: friend.profilephotourl,
                    };

                    // Add requestData to friend's friendRequests
                    await userModel.updateOne(
                        { _id: friendObjId },
                        { $addToSet: { friendRequests: requestDataForFriend } }
                    );

                    // Add friendData to user's sentRequests
                    await userModel.updateOne(
                        { _id: userObjId },
                        { $addToSet: { sentRequests: requestDataForUser } }
                    );

                    return res.json({ message: "Friend request sent" });
                }

            } catch (error) {
                console.error("Friend request error:", error);
                return res.status(500).send("Server error");
            }
        });
        app.put("/unfriend", async (req, res) => {
            try {
                const { userId, friendId } = req.body;
                if (!userId || !friendId) return res.status(400).send("Invalid payload");

                const userObjId = new ObjectId(userId);
                const friendObjId = new ObjectId(friendId);

                // Friend ও User এর full profile আনো
                const user = await userModel.findOne({ _id: userObjId });
                const friend = await userModel.findOne({ _id: friendObjId });

                if (!user || !friend) return res.status(404).send("User or Friend not found");

                // Unfriend user → Remove friend from user's myFriends
                await userModel.updateOne(
                    { _id: userObjId },
                    { $pull: { myFriends: { _id: friend._id, email: friend.email, }, } }
                );

                // Unfriend friend → Remove user from friend's myFriends
                await userModel.updateOne(
                    { _id: friendObjId },
                    { $pull: { myFriends: { _id: user._id, email: user.email, }, }, }
                );

                return res.status(200).json({ message: "Unfriend successful" });
            } catch (error) {
                console.error("Unfriend error:", error);
                res.status(500).send("Server error");
            }
        });
        app.put("/confirmFriend", async (req, res) => {
            const { userId, friendId } = req.body;
            if (!userId || !friendId) {
                return res.status(400).json({ message: "Missing IDs" });
            }
            try {
                const userObjId = new ObjectId(userId);
                const friendObjId = new ObjectId(friendId);

                const user = await userModel.findOne({ _id: userObjId });
                const friend = await userModel.findOne({ _id: friendObjId });

                if (!user || !friend) {
                    return res.status(404).json({ message: "User or Friend not found" });
                }
                const friendRequest = user.friendRequests?.find(fr => fr._id.toString() === friendId);
                if (!friendRequest) {
                    return res.status(400).json({ message: "No friend request found" });
                }
                await userModel.updateOne(
                    { _id: userObjId },
                    { $pull: { friendRequests: { _id: friendObjId } } }
                );
                await userModel.updateOne(
                    { _id: friendObjId },
                    { $pull: { sentRequests: { _id: userObjId } } }
                );
                await userModel.updateOne(
                    { _id: userObjId },
                    {
                        $addToSet: {
                            myFriends: {
                                _id: friend._id,
                                name: friend.name,
                                email: friend.email,
                                username: friend.username,
                                profilephotourl: friend.profilephotourl,
                            }
                        }
                    }
                );
                await userModel.updateOne(
                    { _id: friendObjId },
                    {
                        $addToSet: {
                            myFriends: {
                                _id: user._id,
                                name: user.name,
                                email: user.email,
                                username: user.username,
                                profilephotourl: user.profilephotourl,
                            }
                        }
                    }
                );
                return res.status(200).json({ message: "Friend request accepted" });
            } catch (error) {
                console.error("Error in /confirmFriend route:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
        });

        app.get("/allfriends", async (req, res) => {
            try {
                const email = req.query.email;
                if (!email) return res.status(400).send("Email missing");
                const allUsersExceptMe = await userModel.find({
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
            const friend = await userModel.findOne({ username })
            const posts = await postModel.find().toArray()
            const friendPost = posts.filter(post => post.authorUsername == friend.username)
            const data = { friend, friendPost }
            res.send(data)
        })
        app.get("/message/:id", async (req, res) => {
            const username = req.params.id;
            const friend = await userModel.findOne({ username })
            const posts = await postModel.find().toArray()
            const friendPost = posts.filter(post => post.authorUsername == friend.username)
            const data = { friend, friendPost }
            res.send(data)
        })

        app.get("/myfriends", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");
            try {
                const user = await userModel.findOne({ email });
                if (!user) return res.status(404).send("User not found");
                const myFriends = user.myFriends || [];
                // Directly return the already stored friend objects
                res.send(myFriends);
            } catch (error) {
                console.error("Error in /myfriends route:", error);
                res.status(500).send("Server error");
            }
        });
        app.get("/requests", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");
            try {
                const user = await userModel.findOne({ email });
                if (!user) return res.status(404).send("User not found");
                const requests = user.friendRequests || [];
                res.send(requests);
            } catch (error) {
                console.error("Error in /requests route:", error);
                res.status(500).send("Server error");
            }
        });
        app.get("/sentrequest", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");
            try {
                const user = await userModel.findOne({ email });
                if (!user) return res.status(404).send("User not found");
                const sentRequests = user.sentRequests || [];
                res.send(sentRequests);
            } catch (error) {
                console.error("Error in /sentrequest route:", error);
                res.status(500).send("Server error");
            }
        });
        app.get("/youMayKnow", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send("Email missing");
            try {
                const user = await userModel.findOne({ email });
                if (!user) return res.status(404).send("User not found");
                const allUsers = await userModel.find().toArray();
                const myId = user._id.toString();
                const myFriendIds = user.myFriends?.map(friend => friend._id.toString()) || [];
                const friendRequestIds = user.friendRequests?.map(req => req._id.toString()) || [];
                const sentRequestIds = user.sentRequests?.map(req => req._id.toString()) || [];
                const youMayKnow = allUsers.filter(otherUser => {
                    const otherId = otherUser._id.toString();
                    return (
                        otherId !== myId &&
                        !myFriendIds.includes(otherId) &&
                        !friendRequestIds.includes(otherId) &&
                        !sentRequestIds.includes(otherId)
                    );
                });
                res.send(youMayKnow);
            } catch (error) {
                console.error("Error in /youMayKnow route:", error);
                res.status(500).send("Server error");
            }
        });














    }

    finally { }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("XENON MEDIA v2");
})


// app.listen(port, () => {
//     console.log(port);
// })

module.exports = app;




