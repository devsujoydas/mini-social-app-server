const { MongoClient } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f1vo05q.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri);

async function connectDB() {
    await client.connect();
    console.log("MongoDB Atlas connected ✅");

    const db = client.db("mini-social-app");
    return {
        usersCollection: db.collection("users"),
        postsCollection: db.collection("posts"),
    };
}

module.exports = { connectDB };
