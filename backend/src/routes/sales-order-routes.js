const express = require("express");
const authenticateToken = require("../middleware/authenticate-token");
const requireRole = require("../middleware/require-role");
const {
  getSalesOrders,
  postConfirmSalesOrder,
  postDispatchSalesOrder
} = require("../controllers/sales-order-controller");

const router = express.Router();

router.get("/", authenticateToken, getSalesOrders);
router.post(
  "/:id/confirm",
  authenticateToken,
  requireRole("ADMIN"),
  postConfirmSalesOrder
);
router.post(
  "/:id/dispatch",
  authenticateToken,
  requireRole("ADMIN"),
  postDispatchSalesOrder
);

module.exports = router;
