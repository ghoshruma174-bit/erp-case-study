const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const createBusinessNumber = require("../utils/business-number");
const {
  requireString,
  requirePositiveInteger,
  requireDecimal,
  parseDate
} = require("../utils/validation");

const quotationInclude = {
  customer: true,
  enquiry: { select: { id: true, enquiryNumber: true, status: true } },
  items: {
    include: {
      product: {
        select: { id: true, productCode: true, productName: true, unit: true }
      }
    }
  },
  salesOrder: { select: { id: true, orderNumber: true, status: true } }
};

function calculateLineAmount(quantity, unitPrice, discountPercent, gstPercent) {
  const baseAmount = unitPrice.mul(quantity);
  const discountedAmount = baseAmount.mul(new Prisma.Decimal(100).minus(discountPercent)).div(100);
  const amountWithTax = discountedAmount.mul(new Prisma.Decimal(100).plus(gstPercent)).div(100);
  return amountWithTax.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

async function listQuotations() {
  return prisma.quotation.findMany({
    orderBy: { createdAt: "desc" },
    include: quotationInclude
  });
}

async function createQuotation(body) {
  const enquiryId = requireString(body.enquiryId, "enquiryId", { maxLength: 64 });
  const validUntil = parseDate(body.validUntil, "validUntil");
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, "items must contain at least one quotation item");
  }

  const productsSeen = new Set();
  const requestItems = body.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(400, `items[${index}] must be an object`);
    }
    const productId = requireString(item.productId, `items[${index}].productId`, { maxLength: 64 });
    if (productsSeen.has(productId)) {
      throw new HttpError(400, "A product can only appear once in a quotation");
    }
    productsSeen.add(productId);
    return {
      productId,
      quantity: requirePositiveInteger(item.quantity, `items[${index}].quantity`),
      unitPrice: item.unitPrice === undefined
        ? undefined
        : requireDecimal(item.unitPrice, `items[${index}].unitPrice`),
      discountPercent: requireDecimal(item.discountPercent, `items[${index}].discountPercent`, { max: "100", defaultValue: "0" }),
      gstPercent: requireDecimal(item.gstPercent, `items[${index}].gstPercent`, { max: "100", defaultValue: "18" })
    };
  });

  return prisma.$transaction(async (transaction) => {
    const enquiry = await transaction.enquiry.findUnique({
      where: { id: enquiryId },
      include: { items: { select: { productId: true } } }
    });
    if (!enquiry) {
      throw new HttpError(404, "Enquiry not found");
    }
    if (["WON", "LOST"].includes(enquiry.status)) {
      throw new HttpError(409, `Cannot quote an enquiry with status ${enquiry.status}`);
    }

    const enquiryProductIds = new Set(enquiry.items.map((item) => item.productId));
    if (requestItems.some((item) => !enquiryProductIds.has(item.productId))) {
      throw new HttpError(400, "Every quoted product must be included in the enquiry");
    }

    const products = await transaction.product.findMany({
      where: { id: { in: requestItems.map((item) => item.productId) } },
      select: { id: true, basePrice: true }
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    if (products.length !== requestItems.length) {
      throw new HttpError(404, "One or more quotation products were not found");
    }

    const items = requestItems.map((item) => {
      const product = productById.get(item.productId);
      const unitPrice = item.unitPrice ?? product.basePrice;
      const lineAmount = calculateLineAmount(
        item.quantity,
        unitPrice,
        item.discountPercent,
        item.gstPercent
      );
      return { ...item, unitPrice, lineAmount };
    });
    const grandTotal = items.reduce(
      (total, item) => total.plus(item.lineAmount),
      new Prisma.Decimal(0)
    ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const quotation = await transaction.quotation.create({
      data: {
        quotationNumber: createBusinessNumber("QUO"),
        enquiryId: enquiry.id,
        customerId: enquiry.customerId,
        validUntil,
        grandTotal,
        items: { create: items }
      },
      include: quotationInclude
    });

    if (enquiry.status === "NEW") {
      await transaction.enquiry.update({
        where: { id: enquiry.id },
        data: { status: "QUOTED" }
      });
    }
    return quotation;
  });
}

async function changeQuotationStatus(id, status) {
  if (!["SENT", "ACCEPTED", "REJECTED"].includes(status)) {
    throw new HttpError(400, "Quotation status must be SENT, ACCEPTED, or REJECTED");
  }

  return prisma.$transaction(async (transaction) => {
    const quotation = await transaction.quotation.findUnique({
      where: { id },
      select: { id: true, status: true }
    });
    if (!quotation) {
      throw new HttpError(404, "Quotation not found");
    }

    const allowedTransitions = {
      DRAFT: ["SENT"],
      SENT: ["ACCEPTED", "REJECTED"],
      ACCEPTED: [],
      REJECTED: []
    };
    if (!allowedTransitions[quotation.status].includes(status)) {
      throw new HttpError(409, `Cannot change quotation status from ${quotation.status} to ${status}`);
    }

    const result = await transaction.quotation.updateMany({
      where: { id, status: quotation.status },
      data: { status }
    });
    if (result.count !== 1) {
      throw new HttpError(409, "Quotation status changed concurrently; reload and try again");
    }

    return transaction.quotation.findUnique({
      where: { id },
      include: quotationInclude
    });
  });
}

module.exports = {
  listQuotations,
  createQuotation,
  changeQuotationStatus,
  calculateLineAmount
};
