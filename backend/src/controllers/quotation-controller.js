const HttpError = require("../utils/http-error");
const {
  listQuotations,
  createQuotation,
  changeQuotationStatus
} = require("../services/quotation-service");
const { convertQuotationToSalesOrder } = require("../services/sales-order-service");

async function getQuotations(req, res) {
  const quotations = await listQuotations();
  return res.status(200).json({ quotations });
}

async function postQuotation(req, res) {
  const quotation = await createQuotation(req.body);
  return res.status(201).json({ quotation });
}

async function patchQuotationStatus(req, res) {
  if (!req.body || typeof req.body.status !== "string") {
    throw new HttpError(400, "status is required");
  }
  const quotation = await changeQuotationStatus(req.params.id, req.body.status);
  return res.status(200).json({ quotation });
}

async function convertQuotation(req, res) {
  const salesOrder = await convertQuotationToSalesOrder(req.params.id);
  return res.status(201).json({ salesOrder });
}

module.exports = {
  getQuotations,
  postQuotation,
  patchQuotationStatus,
  convertQuotation
};
