const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");

async function listInventory(req, res) {
  const inventory = await prisma.inventory.findMany({
    orderBy: { product: { productCode: "asc" } },
    include: {
      product: {
        select: {
          id: true,
          productCode: true,
          productName: true,
          category: true,
          unit: true
        }
      }
    }
  });

  return res.status(200).json({
    inventory: inventory.map((record) => ({
      ...record,
      availableQuantity: record.physicalQuantity - record.reservedQuantity
    }))
  });
}

async function updatePhysicalQuantity(req, res) {
  const { productId } = req.params;
  const { physicalQuantity } = req.body;

  if (!Number.isInteger(physicalQuantity) || physicalQuantity < 0) {
    throw new HttpError(400, "physicalQuantity must be a non-negative integer");
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw`
      SELECT "id", "reservedQuantity"
      FROM "Inventory"
      WHERE "productId" = ${productId}
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new HttpError(404, "Inventory record not found");
    }

    if (physicalQuantity < rows[0].reservedQuantity) {
      throw new HttpError(409, "Physical quantity cannot be lower than reserved quantity");
    }

    return transaction.inventory.update({
      where: { productId },
      data: { physicalQuantity },
      include: {
        product: {
          select: { id: true, productCode: true, productName: true }
        }
      }
    });
  });

  return res.status(200).json({
    inventory: {
      ...updated,
      availableQuantity: updated.physicalQuantity - updated.reservedQuantity
    }
  });
}

module.exports = { listInventory, updatePhysicalQuantity };
