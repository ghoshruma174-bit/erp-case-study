const HttpError = require("./http-error");

function requireString(value, field, { maxLength = 200, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${field} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value.trim();
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new HttpError(400, `${field} must be a positive 32-bit integer`);
  }
  return value;
}

function requireDecimal(value, field, { min = "0", max, defaultValue } = {}) {
  const Decimal = require("@prisma/client").Prisma.Decimal;
  if (value === undefined && defaultValue !== undefined) {
    return new Decimal(defaultValue);
  }
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^\d{1,10}(\.\d{1,2})?$/.test(String(value))
  ) {
    throw new HttpError(400, `${field} must be a valid non-negative decimal number`);
  }

  const result = new Decimal(String(value));
  if (result.lessThan(min) || (max !== undefined && result.greaterThan(max))) {
    throw new HttpError(400, `${field} must be between ${min} and ${max ?? "the allowed maximum"}`);
  }
  return result;
}

function parseDate(value, field, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) {
    return undefined;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${field} must be a date in YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${field} must be a valid calendar date`);
  }
  return date;
}

function requireItems(value, field = "items") {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, `${field} must contain at least one item`);
  }
  const seen = new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(400, `${field}[${index}] must be an object`);
    }
    const productId = requireString(item.productId, `${field}[${index}].productId`, { maxLength: 64 });
    if (seen.has(productId)) {
      throw new HttpError(400, `${field} cannot contain the same product more than once`);
    }
    seen.add(productId);
    const quantity = requirePositiveInteger(item.quantity, `${field}[${index}].quantity`);
    return { ...item, productId, quantity };
  });
}

module.exports = {
  requireString,
  requirePositiveInteger,
  requireDecimal,
  parseDate,
  requireItems
};
