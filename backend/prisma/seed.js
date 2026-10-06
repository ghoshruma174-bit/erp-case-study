const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const demoUsers = [
  {
    name: "ERP Administrator",
    email: "admin@example.com",
    password: "Admin@123",
    role: "ADMIN"
  },
  {
    name: "ERP Sales User",
    email: "sales@example.com",
    password: "Sales@123",
    role: "SALES_USER"
  }
];

const products = [
  {
    productCode: "MTR-5HP-3PH",
    productName: "5 HP Three-Phase Induction Motor",
    category: "Electric Motors",
    unit: "each",
    basePrice: "18500.00",
    physicalQuantity: 24
  },
  {
    productCode: "PMP-CENT-2IN",
    productName: "2-Inch Centrifugal Water Pump",
    category: "Pumps",
    unit: "each",
    basePrice: "12400.00",
    physicalQuantity: 18
  },
  {
    productCode: "BRG-6205-2RS",
    productName: "6205-2RS Deep-Groove Ball Bearing",
    category: "Bearings",
    unit: "each",
    basePrice: "420.00",
    physicalQuantity: 250
  },
  {
    productCode: "VLV-GATE-2IN",
    productName: "2-Inch Cast-Iron Gate Valve",
    category: "Valves",
    unit: "each",
    basePrice: "2350.00",
    physicalQuantity: 60
  },
  {
    productCode: "BLT-V-SET-A",
    productName: "Industrial V-Belt Set, Profile A",
    category: "Power Transmission",
    unit: "set",
    basePrice: "780.00",
    physicalQuantity: 100
  },
  {
    productCode: "FLT-HYD-10M",
    productName: "Hydraulic Filter Element, 10 Micron",
    category: "Hydraulics",
    unit: "each",
    basePrice: "1650.00",
    physicalQuantity: 45
  }
];

async function seed() {
  await prisma.$transaction(async (transaction) => {
    for (const user of demoUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 12);

      await transaction.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          password: hashedPassword,
          role: user.role
        },
        create: {
          name: user.name,
          email: user.email,
          password: hashedPassword,
          role: user.role
        }
      });
    }

    for (const product of products) {
      const { physicalQuantity, ...productData } = product;
      const savedProduct = await transaction.product.upsert({
        where: { productCode: product.productCode },
        update: productData,
        create: productData
      });

      await transaction.inventory.upsert({
        where: { productId: savedProduct.id },
        update: {},
        create: {
          productId: savedProduct.id,
          physicalQuantity,
          reservedQuantity: 0
        }
      });
    }
  });

  console.log("Seed complete: 2 demo users, 6 products, and 6 inventory records.");
}

seed()
  .catch((error) => {
    console.error("Database seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
