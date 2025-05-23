const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
var cors = require('cors')
require("dotenv").config()

const app = express()
const port = process.env.PORT || 3000

app.use(cors());
app.use(express.json())



// const uri = "mongodb://localhost:27017";
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
        await client.connect();
        await client.db("userDB").command({ ping: 1 });
        const userModel = client.db("mini-social-app").collection("users")

        console.log("Pinged your deployment. You successfully connected to MongoDB!");


        app.get("/updateInfo/:id", async (req, res) => {
            const userEmail = req.params.id;
            // console.log(userEmail)
            // const user = await userModel.findOne({ email: userEmail })
            // console.log(user)
            res.send("Sams er bou")

        });

        app.put("/update", async (req, res) => {
            const formData = req.body;
            console.log(formData)

            const query = { email: formData.email }
            const options = { upsert: true }
            const updatedUser = { $set: { name, username, email, password, profilephotourl, phone, website, posts } }
            const result = await userModel.updateOne(query, updatedUser, options)
            res.send(result)
        })

        app.post("/signup", async (req, res) => {
            const formData = req.body;

            const user = await userModel.findOne({ email: formData.email })
            if (user) return res.send("This email was already taken")

            const username = await userModel.findOne({ username: formData.username })
            if (username) return res.send("This username was already taken")

            const result = await userModel.insertOne(formData)
            res.send(result).console.log("Account Created Successfully")
        })




    }

    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Hello");
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})





