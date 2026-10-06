const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const { salesOrderInclude } = require("./sales-order-service");

async function confirmSalesOrder(orderId) {
  return prisma.$transaction(async (transaction) => {
    const orderRows = await transaction.$queryRaw`
      SELECT "id", "status"
      FROM "SalesOrder"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
    if (orderRows.length === 0) {
      throw new HttpError(404, "Sales Order not found");
    }
    if (orderRows[0].status !== "PENDING") {
      throw new HttpError(409, `Only PENDING Sales Orders can be confirmed; current status is ${orderRows[0].status}`);
    }

    const order = await transaction.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          orderBy: { productId: "asc" },
          include: { product: { select: { id: true, productCode: true, productName: true } } }
        }
      }
    });
    if (!order.items.length) {
      throw new HttpError(409, "A Sales Order without items cannot be confirmed");
    }

    const productIds = order.items.map((item) => item.productId);
    const inventoryRows = await transaction.$queryRaw(Prisma.sql`
      SELECT "productId", "physicalQuantity", "reservedQuantity"
      FROM "Inventory"
      WHERE "productId" IN (${Prisma.join(productIds)})
      ORDER BY "productId"
      FOR UPDATE
    `);
    const inventoryByProduct = new Map(inventoryRows.map((row) => [row.productId, row]));

    for (const item of order.items) {
      const inventory = inventoryByProduct.get(item.productId);
      if (!inventory) {
        throw new HttpError(409, `Inventory is not configured for ${item.product.productCode}`);
      }
      const available = inventory.physicalQuantity - inventory.reservedQuantity;
      if (item.quantity > available) {
        throw new HttpError(
          409,
          `Insufficient inventory for ${item.product.productName}: ${available} available, ${item.quantity} requested`
        );
      }
    }

    for (const item of order.items) {
      await transaction.inventory.update({
        where: { productId: item.productId },
        data: { reservedQuantity: { increment: item.quantity } }
      });
    }

    await transaction.salesOrder.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" }
    });

    return transaction.salesOrder.findUnique({
      where: { id: orderId },
      include: salesOrderInclude
    });
  });
}

module.exports = { confirmSalesOrder };
