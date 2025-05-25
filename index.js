const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
var cors = require('cors')
require("dotenv").config()

const Friends = require('./public/Friends.json');
const app = express()
const port = process.env.PORT || 3000

app.use(cors());
app.use(express.json())



const uri = "mongodb://localhost:27017";
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f1vo05q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        await client.db("mini-social-app").command({ ping: 1 });

        const userModel = client.db("mini-social-app").collection("users")
        const postModel = client.db("mini-social-app").collection("posts")
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        app.post("/signup", async (req, res) => {
            const formData = req.body;
            const user = await userModel.findOne({ email: formData.email })
            if (user) return res.send("This email was already taken")
            const username = await userModel.findOne({ username: formData.username })
            if (username) return res.send("This username was already taken")
            const result = await userModel.insertOne(formData)
            // console.log("Account Created Successfully")
            res.send(result)
        })

        app.get("/profile/:id", async (req, res) => {
            const userEmail = req.params.id;
            // console.log(userEmail)
            const user = await userModel.findOne({ email: userEmail })
            res.send(user)
        });


        app.get("/updateInfo/:id", async (req, res) => {
            const userEmail = req.params.id;
            const user = await userModel.findOne({ email: userEmail })
            res.send(user)
        });



        app.put("/update", async (req, res) => {
            const { name, username, email, address, profilephotourl, createdDate, phone, website } = req.body;
            const query = { email }
            const updatedUser = { $set: { name, username, address, createdDate, profilephotourl, phone, website } }
            const result = await userModel.updateMany(query, updatedUser)
            res.send(result)
        })


        app.get("/post", async (req, res) => {
            const posts = await postModel.find().sort({ createdDate: -1 }).toArray();
            res.send(posts)
        });

        app.get("/post/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postModel.findOne({ _id: new ObjectId(id) })
            // console.log(post)
            res.send(post)
        });

        app.post("/post", async (req, res) => {
            const postData = req.body;
            const post = await postModel.findOne({ postImageUrl: postData.postImageUrl })
            if (post) return res.send("This Image URL was already taken")
            const result = await postModel.insertOne(postData)
            if (!result) return
            // console.log("Post Upload Successfully")
            const data = { result, postData }
            res.send(data)
        })


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

            console.log(result)

        })
        app.delete("/post/delete/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await postModel.deleteOne(query)
            res.send(result)
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

app.get("/friends", (req, res) => {
    res.send(Friends)
});

app.get("/profiles/:id", (req, res) => {
    const username = req.params.id;
    const friend = Friends.filter(Friend => Friend.username == username)
    res.send(friend)
});

app.listen(port)





