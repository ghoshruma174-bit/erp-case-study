const express = require("express");
const authenticateToken = require("../middleware/authenticate-token");
const requireRole = require("../middleware/require-role");
const {
  getQuotations,
  postQuotation,
  patchQuotationStatus,
  convertQuotation
} = require("../controllers/quotation-controller");

const router = express.Router();

router.get("/", authenticateToken, getQuotations);
router.post("/", authenticateToken, requireRole("SALES_USER"), postQuotation);
router.patch(
  "/:id/status",
  authenticateToken,
  requireRole("SALES_USER"),
  patchQuotationStatus
);
router.post(
  "/:id/convert",
  authenticateToken,
  requireRole("SALES_USER"),
  convertQuotation
);

module.exports = router;
