const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f1vo05q.mongodb.net/?retryWrites=true&w=majority`;

let client;

async function connectDB() {
    try {
        client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
        await client.connect();
        console.log("✅ Connected to MongoDB Atlas");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}

function getCollection(dbName, collectionName) {
    if (!client) throw new Error("MongoDB client not initialized");
    return client.db(dbName).collection(collectionName);
}

module.exports = { connectDB, getCollection };
