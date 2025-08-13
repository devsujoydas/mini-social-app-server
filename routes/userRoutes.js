const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const {
    setActiveStatus,
    search,
    youMayKnow,
    makeAdmin,
    removeAdmin
} = require("../controllers/userController");

// Online status
router.post("/activeStatus", verifyToken, setActiveStatus);

// Search
router.get("/search", verifyToken, search);

// Friend suggestions
router.get("/youMayKnow", verifyToken, youMayKnow);

// Admin role
router.put("/make-admin/:email", verifyToken, makeAdmin);
router.put("/remove-admin/:email", verifyToken, removeAdmin);

module.exports = router;
