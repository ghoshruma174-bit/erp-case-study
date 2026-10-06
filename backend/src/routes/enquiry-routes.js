const express = require("express");
const authenticateToken = require("../middleware/authenticate-token");
const requireRole = require("../middleware/require-role");
const {
  listEnquiries,
  createEnquiry,
  updateEnquiryStatus
} = require("../controllers/enquiry-controller");

const router = express.Router();

router.get("/", authenticateToken, listEnquiries);
router.post("/", authenticateToken, requireRole("SALES_USER"), createEnquiry);
router.patch(
  "/:id/status",
  authenticateToken,
  requireRole("SALES_USER"),
  updateEnquiryStatus
);

module.exports = router;
