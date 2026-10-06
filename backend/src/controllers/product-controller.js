const prisma = require("../config/prisma");

async function listProducts(req, res) {
  const products = await prisma.product.findMany({
    orderBy: { productCode: "asc" },
    include: {
      inventory: {
        select: { physicalQuantity: true, reservedQuantity: true }
      }
    }
  });

  return res.status(200).json({
    products: products.map(({ inventory, ...product }) => ({
      ...product,
      inventory: inventory
        ? {
            ...inventory,
            availableQuantity: inventory.physicalQuantity - inventory.reservedQuantity
          }
        : null
    }))
  });
}

module.exports = { listProducts };
