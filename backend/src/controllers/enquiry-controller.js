const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const createBusinessNumber = require("../utils/business-number");
const {
  requireString,
  parseDate,
  requireItems
} = require("../utils/validation");

const enquiryDetails = {
  customer: true,
  items: {
    include: {
      product: {
        select: {
          id: true,
          productCode: true,
          productName: true,
          unit: true
        }
      }
    }
  }
};

async function listEnquiries(req, res) {
  const enquiries = await prisma.enquiry.findMany({
    orderBy: { createdAt: "desc" },
    include: enquiryDetails
  });
  return res.status(200).json({ enquiries });
}

async function createEnquiry(req, res) {
  const customerId = requireString(req.body.customerId, "customerId", { maxLength: 64 });
  const items = requireItems(req.body.items);
  const enquiryDate = parseDate(req.body.enquiryDate, "enquiryDate", { optional: true });
  const requiredDate = parseDate(req.body.requiredDate, "requiredDate", { optional: true });
  const notes = requireString(req.body.notes, "notes", { maxLength: 2000, optional: true });

  if (requiredDate && enquiryDate && requiredDate < enquiryDate) {
    throw new HttpError(400, "requiredDate cannot be earlier than enquiryDate");
  }

  const [customer, products] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }),
    prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: { id: true }
    })
  ]);
  if (!customer) {
    throw new HttpError(404, "Customer not found");
  }
  if (products.length !== items.length) {
    throw new HttpError(404, "One or more enquiry products were not found");
  }

  const enquiry = await prisma.enquiry.create({
    data: {
      enquiryNumber: createBusinessNumber("ENQ"),
      customerId,
      ...(enquiryDate ? { enquiryDate } : {}),
      ...(requiredDate ? { requiredDate } : {}),
      ...(notes ? { notes } : {}),
      items: {
        create: items.map(({ productId, quantity }) => ({ productId, quantity }))
      }
    },
    include: enquiryDetails
  });

  return res.status(201).json({ enquiry });
}

async function updateEnquiryStatus(req, res) {
  const { status } = req.body;
  if (!["WON", "LOST"].includes(status)) {
    throw new HttpError(400, "Enquiry status can be changed to WON or LOST");
  }

  const enquiry = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
  if (!enquiry) {
    throw new HttpError(404, "Enquiry not found");
  }

  const allowed = status === "LOST"
    ? ["NEW", "QUOTED"]
    : ["QUOTED"];
  if (!allowed.includes(enquiry.status)) {
    throw new HttpError(409, `Cannot change enquiry status from ${enquiry.status} to ${status}`);
  }

  const updated = await prisma.enquiry.update({
    where: { id: enquiry.id },
    data: { status },
    include: enquiryDetails
  });
  return res.status(200).json({ enquiry: updated });
}

module.exports = { listEnquiries, createEnquiry, updateEnquiryStatus };
