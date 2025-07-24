const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
var cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require("dotenv").config()

const app = express()
const port = process.env.PORT || 3000


app.use(cors({
    origin: 'http://localhost:5173',
    // ['https://xenonmedia.netlify.app', 'http://localhost:5173',],
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

async function run() {
    try {
        // await client.connect();
        // await client.db("mini-social-app").command({ ping: 1 });

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
        })

        // Friends Related Apis 

        app.get("/friends", async (req, res) => {
            const allfriends = await userModel.find().toArray();
            res.send(allfriends)
        })

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
    }

    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Hello This Is Mini-Social-App by XENON MEDIA");
})


app.listen(port, () => {
    console.log(port);
})





