const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const createBusinessNumber = require("../utils/business-number");
const { requireString, parseDate } = require("../utils/validation");
const { salesOrderInclude } = require("./sales-order-service");

async function dispatchSalesOrder(orderId, body) {
  const vehicleNumber = requireString(body.vehicleNumber, "vehicleNumber", { maxLength: 40 });
  const driverName = requireString(body.driverName, "driverName", { maxLength: 120 });
  const dispatchDate = parseDate(body.dispatchDate, "dispatchDate", { optional: true });

  return prisma.$transaction(async (transaction) => {
    const lockedOrders = await transaction.$queryRaw`
      SELECT "id", "status"
      FROM "SalesOrder"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
    if (lockedOrders.length === 0) {
      throw new HttpError(404, "Sales Order not found");
    }
    if (lockedOrders[0].status === "CANCELLED") {
      throw new HttpError(409, "Cancelled Sales Orders cannot be dispatched");
    }
    if (lockedOrders[0].status !== "CONFIRMED") {
      throw new HttpError(409, `Only CONFIRMED Sales Orders can be dispatched; current status is ${lockedOrders[0].status}`);
    }
    const existingDispatch = await transaction.dispatch.findUnique({
      where: { salesOrderId: orderId },
      select: { id: true }
    });
    if (existingDispatch) {
      throw new HttpError(409, "This Sales Order has already been dispatched");
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
      throw new HttpError(409, "A Sales Order without items cannot be dispatched");
    }

    let dispatchItems = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity
    }));
    if (body.items !== undefined) {
      if (!Array.isArray(body.items) || body.items.length !== order.items.length) {
        throw new HttpError(400, "Dispatch must include every Sales Order product exactly once");
      }
      const provided = new Map();
      for (const [index, item] of body.items.entries()) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw new HttpError(400, `items[${index}] must be an object`);
        }
        const productId = requireString(item.productId, `items[${index}].productId`, { maxLength: 64 });
        if (provided.has(productId)) {
          throw new HttpError(400, "A product can only appear once in a dispatch");
        }
        if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
          throw new HttpError(400, `items[${index}].quantity must be a positive integer`);
        }
        provided.set(productId, item.quantity);
      }
      dispatchItems = order.items.map((orderItem) => {
        const requested = provided.get(orderItem.productId);
        if (requested === undefined || requested !== orderItem.quantity) {
          throw new HttpError(400, "Dispatch quantities must match the confirmed Sales Order quantities");
        }
        return { productId: orderItem.productId, quantity: requested };
      });
    }

    const productIds = dispatchItems.map((item) => item.productId);
    const inventoryRows = await transaction.$queryRaw(Prisma.sql`
      SELECT "productId", "physicalQuantity", "reservedQuantity"
      FROM "Inventory"
      WHERE "productId" IN (${Prisma.join(productIds)})
      ORDER BY "productId"
      FOR UPDATE
    `);
    const inventoryByProduct = new Map(inventoryRows.map((row) => [row.productId, row]));

    for (const item of dispatchItems) {
      const stock = inventoryByProduct.get(item.productId);
      const orderItem = order.items.find((line) => line.productId === item.productId);
      if (!stock) {
        throw new HttpError(409, `Inventory is not configured for ${orderItem.product.productCode}`);
      }
      if (item.quantity > stock.reservedQuantity) {
        throw new HttpError(
          409,
          `Cannot dispatch ${item.quantity} units of ${orderItem.product.productName}; only ${stock.reservedQuantity} are reserved`
        );
      }
      if (item.quantity > stock.physicalQuantity) {
        throw new HttpError(
          409,
          `Cannot dispatch ${item.quantity} units of ${orderItem.product.productName}; only ${stock.physicalQuantity} are physical`
        );
      }
    }

    for (const item of dispatchItems) {
      await transaction.inventory.update({
        where: { productId: item.productId },
        data: {
          physicalQuantity: { decrement: item.quantity },
          reservedQuantity: { decrement: item.quantity }
        }
      });
    }

    const dispatch = await transaction.dispatch.create({
      data: {
        dispatchNumber: createBusinessNumber("DSP"),
        salesOrderId: order.id,
        vehicleNumber,
        driverName,
        ...(dispatchDate ? { dispatchDate } : {}),
        items: { create: dispatchItems }
      },
      include: {
        items: {
          include: {
            product: {
              select: { productCode: true, productName: true, unit: true }
            }
          }
        }
      }
    });

    await transaction.salesOrder.update({
      where: { id: order.id },
      data: { status: "DISPATCHED" }
    });

    return {
      dispatch,
      salesOrder: await transaction.salesOrder.findUnique({
        where: { id: order.id },
        include: salesOrderInclude
      })
    };
  });
}

module.exports = { dispatchSalesOrder };
