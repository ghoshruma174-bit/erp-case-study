const express = require("express");
const authenticateToken = require("../middleware/authenticate-token");
const { login, getCurrentUser } = require("../controllers/auth-controller");

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticateToken, getCurrentUser);

module.exports = router;
