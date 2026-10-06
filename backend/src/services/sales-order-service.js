const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const createBusinessNumber = require("../utils/business-number");

const salesOrderInclude = {
  customer: true,
  quotation: {
    select: {
      id: true,
      quotationNumber: true,
      enquiry: { select: { id: true, enquiryNumber: true } }
    }
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          productCode: true,
          productName: true,
          unit: true,
          inventory: {
            select: { physicalQuantity: true, reservedQuantity: true }
          }
        }
      }
    }
  },
  dispatch: { include: { items: true } }
};

async function listSalesOrders() {
  return prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: salesOrderInclude
  });
}

async function convertQuotationToSalesOrder(quotationId) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const lockedRows = await transaction.$queryRaw`
        SELECT "id", "customerId", "status"
        FROM "Quotation"
        WHERE "id" = ${quotationId}
        FOR UPDATE
      `;
      if (lockedRows.length === 0) {
        throw new HttpError(404, "Quotation not found");
      }
      const lockedQuotation = lockedRows[0];
      if (lockedQuotation.status !== "ACCEPTED") {
        throw new HttpError(409, `Only ACCEPTED quotations can be converted; current status is ${lockedQuotation.status}`);
      }

      const existingOrder = await transaction.salesOrder.findUnique({
        where: { quotationId },
        select: { id: true, orderNumber: true }
      });
      if (existingOrder) {
        throw new HttpError(409, "This quotation has already been converted to a Sales Order");
      }

      const quotation = await transaction.quotation.findUnique({
        where: { id: quotationId },
        include: { items: true }
      });
      if (!quotation || quotation.items.length === 0) {
        throw new HttpError(409, "A quotation without items cannot be converted");
      }

      return transaction.salesOrder.create({
        data: {
          orderNumber: createBusinessNumber("SO"),
          customerId: quotation.customerId,
          quotationId: quotation.id,
          totalAmount: quotation.grandTotal,
          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineAmount: item.lineAmount
            }))
          }
        },
        include: salesOrderInclude
      });
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new HttpError(409, "This quotation has already been converted to a Sales Order");
    }
    throw error;
  }
}

module.exports = { listSalesOrders, convertQuotationToSalesOrder, salesOrderInclude };
