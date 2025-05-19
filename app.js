const express = require('express');
const path = require('path');
var cors = require('cors')

const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const userModel = require('./models/user');
const postModel = require('./models/post');

const app = express()
const port = process.env.PORT || 3000

app.use(cors());
app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))

// ✅ All real routes here first
app.get("/", (req, res) => {
    res.send("Hello");
});

app.get("/profile", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email }).populate("posts");
    res.send({ user })
})


app.post("/signup", async (req, res) => {
    let { firstName, lastName, username, phone, email, password } = req.body;

    let user = await userModel.findOne({ email })
    if (user) return res.status(500).send("User already Registered");

    let userName = await userModel.findOne({ username })
    if (userName) return res.send("This Username is already taken");

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let createdUser = await userModel.create({ firstName, lastName, username, phone, email, password: hash })
        })
    })
})


app.post("/login", async (req, res) => {
    let { email, password } = req.body;

    let user = await userModel.findOne({ email })
    if (!user) return res.status(500).send("Something is Wrong");

    bcrypt.compare(password, user.password, async (err, result) => {
        if (result) {
            let token = jwt.sign({ email, userid: user._id }, "secretekey")
            res.cookie("token", token)
            res.status(200)
        }
        else {
            res.status(400).send("Something is wrong")
        }
    })
})

app.post("/logout", (req, res) => {
    res.cookie("token", "")
})



// ❌ This must come LAST
app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
});


function isLoggedIn(req, res, next) {
    if (req.cookies.token === "") {
        res.redirect("/login")
    }
    else {
        let data = jwt.verify(req.cookies.token, "secretekey")
        req.user = data;
        next()
    }
}


app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})





