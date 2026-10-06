const HttpError = require("../utils/http-error");

function notFound(req, res, next) {
  next(new HttpError(404, "Route not found"));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must contain valid JSON" });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }

  if (error.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ message: "This origin is not allowed" });
  }

  if (error.code === "P2002") {
    return res.status(409).json({ message: "A record with one of these values already exists" });
  }

  if (error.code === "P2003" || error.code === "P2004") {
    return res.status(400).json({ message: "The request violates a database constraint" });
  }

  console.error("Unhandled request error:", error.message);
  return res.status(500).json({ message: "An unexpected server error occurred" });
}

module.exports = { notFound, errorHandler };
