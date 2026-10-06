const express = require("express");
const authenticateToken = require("../middleware/authenticate-token");
const { listProducts } = require("../controllers/product-controller");

const router = express.Router();

router.get("/", authenticateToken, listProducts);

module.exports = router;
