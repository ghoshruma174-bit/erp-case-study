const express = require("express");
const authenticateToken = require("../middleware/authenticate-token");
const requireRole = require("../middleware/require-role");
const {
  listInventory,
  updatePhysicalQuantity
} = require("../controllers/inventory-controller");

const router = express.Router();

router.get("/", authenticateToken, listInventory);
router.patch(
  "/:productId",
  authenticateToken,
  requireRole("ADMIN"),
  updatePhysicalQuantity
);

module.exports = router;
