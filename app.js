const cookieParser = require('cookie-parser');
const app = express()
const port = process.env.PORT || 5001

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('./models/user');
const postModel = require('./models/post');

app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({extended:true}))
app.use(express.static(Path2D.join(__dirname, "public")))


app.get("/", (req,res)=>{
    res.send("Hello")
})

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})





