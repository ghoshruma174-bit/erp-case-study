const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth-routes");
const productRoutes = require("./routes/product-routes");
const inventoryRoutes = require("./routes/inventory-routes");
const customerRoutes = require("./routes/customer-routes");
const enquiryRoutes = require("./routes/enquiry-routes");
const quotationRoutes = require("./routes/quotation-routes");
const salesOrderRoutes = require("./routes/sales-order-routes");
const { notFound, errorHandler } = require("./middleware/error-handler");

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS"));
  }
}));
app.use(express.json());
app.use((req, res, next) => {
  if (["POST", "PATCH", "PUT"].includes(req.method)) {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }
  }
  return next();
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "ERP Backend is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/sales-orders", salesOrderRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
