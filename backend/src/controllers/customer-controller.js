const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const { requireString } = require("../utils/validation");

function normalizeEmail(value, field = "email") {
  const email = requireString(value, field, { maxLength: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, `${field} must be a valid email address`);
  }
  return email;
}

async function listCustomers(req, res) {
  const customers = await prisma.customer.findMany({
    orderBy: { companyName: "asc" }
  });
  return res.status(200).json({ customers });
}

async function createCustomer(req, res) {
  const customer = await prisma.customer.create({
    data: {
      companyName: requireString(req.body.companyName, "companyName"),
      contactPerson: requireString(req.body.contactPerson, "contactPerson"),
      mobile: requireString(req.body.mobile, "mobile", { maxLength: 40 }),
      email: normalizeEmail(req.body.email),
      city: requireString(req.body.city, "city")
    }
  });
  return res.status(201).json({ customer });
}

module.exports = { listCustomers, createCustomer };
