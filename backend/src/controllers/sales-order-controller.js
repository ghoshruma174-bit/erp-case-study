const HttpError = require("../utils/http-error");
const {
  listSalesOrders,
  convertQuotationToSalesOrder
} = require("../services/sales-order-service");
const { confirmSalesOrder } = require("../services/inventory-reservation-service");
const { dispatchSalesOrder } = require("../services/dispatch-service");

async function getSalesOrders(req, res) {
  const salesOrders = await listSalesOrders();
  return res.status(200).json({ salesOrders });
}

async function convertQuotation(req, res) {
  const order = await convertQuotationToSalesOrder(req.params.id);
  return res.status(201).json({ salesOrder: order });
}

async function postConfirmSalesOrder(req, res) {
  const salesOrder = await confirmSalesOrder(req.params.id);
  return res.status(200).json({ salesOrder });
}

async function postDispatchSalesOrder(req, res) {
  const result = await dispatchSalesOrder(req.params.id, req.body);
  return res.status(201).json(result);
}

module.exports = {
  getSalesOrders,
  convertQuotation,
  postConfirmSalesOrder,
  postDispatchSalesOrder
};
