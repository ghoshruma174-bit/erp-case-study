const { randomBytes } = require("node:crypto");

function createBusinessNumber(prefix) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

module.exports = createBusinessNumber;
