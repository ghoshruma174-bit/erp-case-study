require("dotenv").config();

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const { PrismaClient, Prisma } = require("@prisma/client");
const app = require("../src/app");

const prisma = new PrismaClient();
const records = {
  customerIds: [],
  productIds: [],
  enquiryIds: [],
  quotationIds: [],
  salesOrderIds: [],
  dispatchIds: []
};

let server;
let baseUrl;

async function request(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function login(email, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
  assert.equal(response.status, 200, response.data.message);
  return response.data;
}

async function createCustomer(suffix) {
  const response = await request("/api/customers", {
    method: "POST",
    token: salesToken,
    body: {
      companyName: `Case Study Customer ${suffix}`,
      contactPerson: "Evaluation Contact",
      mobile: "9876543210",
      email: `case-${suffix}@example.test`,
      city: "Pune"
    }
  });
  assert.equal(response.status, 201, response.data.message);
  records.customerIds.push(response.data.customer.id);
  return response.data.customer;
}

async function createProduct(suffix, code, physicalQuantity) {
  const product = await prisma.product.create({
    data: {
      productCode: `T-${suffix}-${code}`,
      productName: `Test Industrial Product ${code}`,
      category: "Test Equipment",
      unit: "each",
      basePrice: new Prisma.Decimal("100.00"),
      inventory: { create: { physicalQuantity, reservedQuantity: 0 } }
    }
  });
  records.productIds.push(product.id);
  return product;
}

async function createEnquiry(customerId, items) {
  const response = await request("/api/enquiries", {
    method: "POST",
    token: salesToken,
    body: { customerId, items }
  });
  assert.equal(response.status, 201, response.data.message);
  records.enquiryIds.push(response.data.enquiry.id);
  return response.data.enquiry;
}

async function createQuotation(enquiryId, items) {
  const response = await request("/api/quotations", {
    method: "POST",
    token: salesToken,
    body: { enquiryId, validUntil: "2027-12-31", items, grandTotal: 0 }
  });
  assert.equal(response.status, 201, response.data.message);
  records.quotationIds.push(response.data.quotation.id);
  return response.data.quotation;
}

async function acceptQuotation(quotation) {
  let response = await request(`/api/quotations/${quotation.id}/status`, {
    method: "PATCH",
    token: salesToken,
    body: { status: "SENT" }
  });
  assert.equal(response.status, 200, response.data.message);
  response = await request(`/api/quotations/${quotation.id}/status`, {
    method: "PATCH",
    token: salesToken,
    body: { status: "ACCEPTED" }
  });
  assert.equal(response.status, 200, response.data.message);
}

async function createDirectOrder(customerId, enquiryId, productId, suffix, quantity) {
  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber: `TEST-Q-${suffix}`,
      enquiryId,
      customerId,
      validUntil: new Date("2027-12-31T00:00:00Z"),
      status: "ACCEPTED",
      grandTotal: new Prisma.Decimal(quantity),
      items: {
        create: {
          productId,
          quantity,
          unitPrice: new Prisma.Decimal(1),
          discountPercent: new Prisma.Decimal(0),
          gstPercent: new Prisma.Decimal(0),
          lineAmount: new Prisma.Decimal(quantity)
        }
      }
    }
  });
  records.quotationIds.push(quotation.id);
  const order = await prisma.salesOrder.create({
    data: {
      orderNumber: `TEST-SO-${suffix}`,
      customerId,
      quotationId: quotation.id,
      totalAmount: new Prisma.Decimal(quantity),
      items: {
        create: {
          productId,
          quantity,
          unitPrice: new Prisma.Decimal(1),
          lineAmount: new Prisma.Decimal(quantity)
        }
      }
    }
  });
  records.salesOrderIds.push(order.id);
  return order;
}

async function cleanDatabaseFixtures() {
  await prisma.$transaction(async (transaction) => {
    if (records.dispatchIds.length) {
      await transaction.dispatchItem.deleteMany({
        where: { dispatchId: { in: records.dispatchIds } }
      });
      await transaction.dispatch.deleteMany({
        where: { id: { in: records.dispatchIds } }
      });
    }
    if (records.salesOrderIds.length) {
      await transaction.salesOrderItem.deleteMany({
        where: { salesOrderId: { in: records.salesOrderIds } }
      });
      await transaction.salesOrder.deleteMany({
        where: { id: { in: records.salesOrderIds } }
      });
    }
    if (records.quotationIds.length) {
      await transaction.quotationItem.deleteMany({
        where: { quotationId: { in: records.quotationIds } }
      });
      await transaction.quotation.deleteMany({
        where: { id: { in: records.quotationIds } }
      });
    }
    if (records.enquiryIds.length) {
      await transaction.enquiryItem.deleteMany({
        where: { enquiryId: { in: records.enquiryIds } }
      });
      await transaction.enquiry.deleteMany({
        where: { id: { in: records.enquiryIds } }
      });
    }
    if (records.productIds.length) {
      await transaction.inventory.deleteMany({
        where: { productId: { in: records.productIds } }
      });
      await transaction.product.deleteMany({
        where: { id: { in: records.productIds } }
      });
    }
    if (records.customerIds.length) {
      await transaction.customer.deleteMany({
        where: { id: { in: records.customerIds } }
      });
    }
  });
}

let adminToken;
let salesToken;

before(async () => {
  await prisma.$connect();
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve());
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    await cleanDatabaseFixtures();
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});

test("authenticates roles and protects the complete sales and inventory workflow", async () => {
  const admin = await login("admin@example.com", "Admin@123");
  const sales = await login("sales@example.com", "Sales@123");
  adminToken = admin.token;
  salesToken = sales.token;
  assert.equal(admin.user.role, "ADMIN");
  assert.equal(sales.user.role, "SALES_USER");
  assert.equal(Object.hasOwn(admin.user, "password"), false);

  let response = await request("/api/products", { token: salesToken });
  assert.equal(response.status, 200);
  assert.ok(response.data.products.length >= 6);
  response = await request("/api/inventory", { token: adminToken });
  assert.equal(response.status, 200);
  assert.ok(response.data.inventory.length >= 6);

  response = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@example.com", password: "incorrect" }
  });
  assert.equal(response.status, 401);
  response = await request("/api/auth/me");
  assert.equal(response.status, 401);
  response = await request("/api/auth/me", { token: "invalid-token" });
  assert.equal(response.status, 401);
  response = await request("/api/auth/me", { token: salesToken });
  assert.equal(response.status, 200);
  assert.equal(response.data.user.email, "sales@example.com");
  assert.equal(Object.hasOwn(response.data.user, "password"), false);

  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const customer = await createCustomer(suffix);
  const productA = await createProduct(suffix, "A", 200);
  const productB = await createProduct(suffix, "B", 100);
  const enquiry = await createEnquiry(customer.id, [
    { productId: productA.id, quantity: 2 },
    { productId: productB.id, quantity: 1 }
  ]);
  assert.equal(enquiry.items.length, 2);

  response = await request("/api/enquiries", {
    method: "POST",
    token: salesToken,
    body: { customerId: "missing-customer", items: [{ productId: productA.id, quantity: 1 }] }
  });
  assert.equal(response.status, 404);
  response = await request("/api/enquiries", {
    method: "POST",
    token: salesToken,
    body: { customerId: customer.id, items: [{ productId: productA.id, quantity: 0 }] }
  });
  assert.equal(response.status, 400);

  const quoteItems = [
    { productId: productA.id, quantity: 2, unitPrice: "100.00", discountPercent: "10", gstPercent: "18" },
    { productId: productB.id, quantity: 1, unitPrice: "50.00", discountPercent: "0", gstPercent: "5" }
  ];
  const draft = await createQuotation(enquiry.id, quoteItems);
  assert.equal(draft.grandTotal.toString(), "264.9");
  assert.equal(
    draft.items.find((item) => item.productId === productA.id).lineAmount.toString(),
    "212.4"
  );
  assert.equal(
    draft.items.find((item) => item.productId === productB.id).lineAmount.toString(),
    "52.5"
  );
  for (const invalidLine of [
    { productId: productA.id, quantity: 1, unitPrice: "1", discountPercent: "101", gstPercent: "18" },
    { productId: productA.id, quantity: 1, unitPrice: "1", discountPercent: "0", gstPercent: "101" },
    { productId: productA.id, quantity: 1, unitPrice: "1.001", discountPercent: "0", gstPercent: "18" }
  ]) {
    response = await request("/api/quotations", {
      method: "POST",
      token: salesToken,
      body: { enquiryId: enquiry.id, validUntil: "2027-12-31", items: [invalidLine] }
    });
    assert.equal(response.status, 400);
  }
  response = await request(`/api/quotations/${draft.id}/convert`, { method: "POST", token: salesToken, body: {} });
  assert.equal(response.status, 409);
  response = await request(`/api/quotations/${draft.id}/status`, {
    method: "PATCH", token: salesToken, body: { status: "SENT" }
  });
  assert.equal(response.status, 200);
  response = await request(`/api/quotations/${draft.id}/status`, {
    method: "PATCH", token: salesToken, body: { status: "REJECTED" }
  });
  assert.equal(response.status, 200);
  response = await request(`/api/quotations/${draft.id}/convert`, { method: "POST", token: salesToken, body: {} });
  assert.equal(response.status, 409);

  const acceptedQuote = await createQuotation(enquiry.id, quoteItems);
  await acceptQuotation(acceptedQuote);
  response = await request(`/api/quotations/${acceptedQuote.id}/convert`, {
    method: "POST", token: salesToken, body: {}
  });
  assert.equal(response.status, 201, response.data.message);
  const order = response.data.salesOrder;
  records.salesOrderIds.push(order.id);
  assert.equal(order.items.length, 2);
  assert.equal(order.totalAmount, "264.9");
  response = await request(`/api/quotations/${acceptedQuote.id}/convert`, {
    method: "POST", token: salesToken, body: {}
  });
  assert.equal(response.status, 409);

  const stockBefore = await prisma.inventory.findMany({
    where: { productId: { in: [productA.id, productB.id] } }
  });
  response = await request(`/api/sales-orders/${order.id}/confirm`, {
    method: "POST", token: salesToken, body: {}
  });
  assert.equal(response.status, 403);
  response = await request(`/api/sales-orders/${order.id}/confirm`, {
    method: "POST", token: adminToken, body: {}
  });
  assert.equal(response.status, 200, response.data.message);
  assert.equal(response.data.salesOrder.status, "CONFIRMED");
  const stockReserved = await prisma.inventory.findMany({
    where: { productId: { in: [productA.id, productB.id] } }
  });
  for (const previous of stockBefore) {
    const current = stockReserved.find((row) => row.productId === previous.productId);
    const requested = order.items.find((row) => row.productId === previous.productId).quantity;
    assert.equal(current.physicalQuantity, previous.physicalQuantity);
    assert.equal(current.reservedQuantity, previous.reservedQuantity + requested);
  }

  response = await request(`/api/sales-orders/${order.id}/confirm`, {
    method: "POST", token: adminToken, body: {}
  });
  assert.equal(response.status, 409);

  const tooLargeQuote = await createQuotation(enquiry.id, [
    { productId: productA.id, quantity: 201, unitPrice: "1", gstPercent: "0" }
  ]);
  await acceptQuotation(tooLargeQuote);
  response = await request(`/api/quotations/${tooLargeQuote.id}/convert`, {
    method: "POST", token: salesToken, body: {}
  });
  assert.equal(response.status, 201);
  records.salesOrderIds.push(response.data.salesOrder.id);
  const stockBeforeFailure = await prisma.inventory.findUnique({ where: { productId: productA.id } });
  response = await request(`/api/sales-orders/${response.data.salesOrder.id}/confirm`, {
    method: "POST", token: adminToken, body: {}
  });
  assert.equal(response.status, 409);
  const stockAfterFailure = await prisma.inventory.findUnique({ where: { productId: productA.id } });
  assert.equal(stockAfterFailure.physicalQuantity, stockBeforeFailure.physicalQuantity);
  assert.equal(stockAfterFailure.reservedQuantity, stockBeforeFailure.reservedQuantity);

  response = await request(`/api/sales-orders/${order.id}/dispatch`, {
    method: "POST", token: salesToken, body: { vehicleNumber: "TEST-1", driverName: "Test Driver" }
  });
  assert.equal(response.status, 403);

  const firstLine = order.items.find((row) => row.productId === productA.id);
  await prisma.inventory.update({
    where: { productId: productA.id },
    data: { reservedQuantity: { decrement: 1 } }
  });
  const stockBeforeFailedDispatch = await prisma.inventory.findUnique({
    where: { productId: productA.id }
  });
  response = await request(`/api/sales-orders/${order.id}/dispatch`, {
    method: "POST",
    token: adminToken,
    body: { vehicleNumber: "TEST-1", driverName: "Test Driver" }
  });
  assert.equal(response.status, 409);
  const unchangedAfterDispatchFailure = await prisma.inventory.findUnique({
    where: { productId: productA.id }
  });
  assert.equal(unchangedAfterDispatchFailure.physicalQuantity, stockBeforeFailedDispatch.physicalQuantity);
  assert.equal(unchangedAfterDispatchFailure.reservedQuantity, stockBeforeFailedDispatch.reservedQuantity);
  await prisma.inventory.update({
    where: { productId: productA.id },
    data: { reservedQuantity: { increment: 1 } }
  });

  const dispatchBefore = await prisma.inventory.findMany({
    where: { productId: { in: [productA.id, productB.id] } }
  });
  response = await request(`/api/sales-orders/${order.id}/dispatch`, {
    method: "POST",
    token: adminToken,
    body: { vehicleNumber: "MH12AB1234", driverName: "Evaluation Driver" }
  });
  assert.equal(response.status, 201, response.data.message);
  records.dispatchIds.push(response.data.dispatch.id);
  assert.equal(response.data.salesOrder.status, "DISPATCHED");
  const stockDispatched = await prisma.inventory.findMany({
    where: { productId: { in: [productA.id, productB.id] } }
  });
  for (const previous of dispatchBefore) {
    const current = stockDispatched.find((row) => row.productId === previous.productId);
    const shipped = order.items.find((row) => row.productId === previous.productId).quantity;
    assert.equal(current.physicalQuantity, previous.physicalQuantity - shipped);
    assert.equal(current.reservedQuantity, previous.reservedQuantity - shipped);
    assert.equal(current.physicalQuantity - current.reservedQuantity, previous.physicalQuantity - previous.reservedQuantity);
  }
  response = await request(`/api/sales-orders/${order.id}/dispatch`, {
    method: "POST", token: adminToken, body: { vehicleNumber: "TEST-1", driverName: "Test Driver" }
  });
  assert.equal(response.status, 409);
  assert.equal(firstLine.quantity, 2);

  const cancelledOrder = await createDirectOrder(
    customer.id,
    enquiry.id,
    productB.id,
    `CANCEL-${suffix}`,
    1
  );
  await prisma.salesOrder.update({ where: { id: cancelledOrder.id }, data: { status: "CANCELLED" } });
  response = await request(`/api/sales-orders/${cancelledOrder.id}/dispatch`, {
    method: "POST",
    token: adminToken,
    body: { vehicleNumber: "TEST-1", driverName: "Test Driver" }
  });
  assert.equal(response.status, 409);

  const inventoryResponse = await request("/api/inventory", { token: adminToken });
  assert.equal(inventoryResponse.status, 200);
  const listedStock = inventoryResponse.data.inventory.find((row) => row.productId === productA.id);
  assert.equal(listedStock.availableQuantity, listedStock.physicalQuantity - listedStock.reservedQuantity);

  const enquiryList = await request("/api/enquiries", { token: salesToken });
  const quotationList = await request("/api/quotations", { token: salesToken });
  const orderList = await request("/api/sales-orders", { token: adminToken });
  assert.equal(enquiryList.status, 200);
  assert.equal(quotationList.status, 200);
  assert.equal(orderList.status, 200);
});

test("serializes simultaneous reservations so total reserved stock cannot exceed physical stock", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const customer = await createCustomer(`CON-${suffix}`);
  const product = await createProduct(suffix, "RACE", 100);
  const enquiry = await createEnquiry(customer.id, [{ productId: product.id, quantity: 130 }]);
  const order80 = await createDirectOrder(customer.id, enquiry.id, product.id, `A-${suffix}`, 80);
  const order50 = await createDirectOrder(customer.id, enquiry.id, product.id, `B-${suffix}`, 50);

  const results = await Promise.all([
    request(`/api/sales-orders/${order80.id}/confirm`, { method: "POST", token: adminToken, body: {} }),
    request(`/api/sales-orders/${order50.id}/confirm`, { method: "POST", token: adminToken, body: {} })
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
  assert.ok(inventory.reservedQuantity <= inventory.physicalQuantity);
  assert.ok([50, 80].includes(inventory.reservedQuantity));
  assert.equal(inventory.physicalQuantity, 100);

  const exactProduct = await createProduct(suffix, "EXACT", 100);
  const exactEnquiry = await createEnquiry(customer.id, [{ productId: exactProduct.id, quantity: 100 }]);
  const exactOrder = await createDirectOrder(customer.id, exactEnquiry.id, exactProduct.id, `EXACT-${suffix}`, 100);
  let response = await request(`/api/sales-orders/${exactOrder.id}/confirm`, {
    method: "POST", token: adminToken, body: {}
  });
  assert.equal(response.status, 200);
  let exactInventory = await prisma.inventory.findUnique({ where: { productId: exactProduct.id } });
  assert.equal(exactInventory.physicalQuantity - exactInventory.reservedQuantity, 0);
  response = await request(`/api/sales-orders/${exactOrder.id}/dispatch`, {
    method: "POST",
    token: adminToken,
    body: { vehicleNumber: "TEST-EXACT", driverName: "Exact Stock Driver" }
  });
  assert.equal(response.status, 201);
  records.dispatchIds.push(response.data.dispatch.id);
  exactInventory = await prisma.inventory.findUnique({ where: { productId: exactProduct.id } });
  assert.equal(exactInventory.physicalQuantity, 0);
  assert.equal(exactInventory.reservedQuantity, 0);
});
