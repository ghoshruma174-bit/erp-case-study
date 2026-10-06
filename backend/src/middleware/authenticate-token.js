const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

async function authenticateToken(req, res, next) {
  const authorization = req.get("authorization");
  const [scheme, token, extra] = authorization ? authorization.split(" ") : [];

  if (scheme !== "Bearer" || !token || extra) {
    return res.status(401).json({ message: "A valid Bearer token is required" });
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    if (
      typeof claims !== "object" ||
      typeof claims.sub !== "string" ||
      !["ADMIN", "SALES_USER"].includes(claims.role)
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, role: true }
    });

    if (!user || user.role !== claims.role) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    return next(error);
  }
}

module.exports = authenticateToken;
