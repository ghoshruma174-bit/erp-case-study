const express = require("express");
const authenticateToken = require("../middleware/authenticate-token");
const requireRole = require("../middleware/require-role");
const { listCustomers, createCustomer } = require("../controllers/customer-controller");

const router = express.Router();

router.get("/", authenticateToken, listCustomers);
router.post("/", authenticateToken, requireRole("SALES_USER"), createCustomer);

module.exports = router;
