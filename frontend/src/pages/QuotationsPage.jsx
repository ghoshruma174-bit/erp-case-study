import { useEffect, useState } from "react";
import { EmptyState, Feedback, Loading } from "../components/Feedback";
import { apiRequest } from "../services/api";

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(amount));
}

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [enquiryId, setEnquiryId] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [quotationResult, enquiryResult] = await Promise.all([
        apiRequest("/quotations"),
        apiRequest("/enquiries")
      ]);
      setQuotations(quotationResult.quotations);
      setEnquiries(enquiryResult.enquiries);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createQuotation(event) {
    event.preventDefault();
    setBusyId("create");
    setError("");
    setSuccess("");
    const enquiry = enquiries.find((entry) => entry.id === enquiryId);
    try {
      const result = await apiRequest("/quotations", {
        method: "POST",
        body: JSON.stringify({
          enquiryId,
          validUntil,
          items: enquiry.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.basePrice,
            discountPercent: 0,
            gstPercent: 18
          }))
        })
      });
      setQuotations((current) => [result.quotation, ...current]);
      setSuccess(`Quotation ${result.quotation.quotationNumber} created. Total calculated by the backend.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  async function changeStatus(quotation, status) {
    setBusyId(quotation.id);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/quotations/${quotation.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
      setSuccess(`Quotation marked ${status}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  async function convert(quotation) {
    setBusyId(quotation.id);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest(`/quotations/${quotation.id}/convert`, { method: "POST", body: "{}" });
      await load();
      setSuccess(`Sales Order ${result.salesOrder.orderNumber} created.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <Loading />;

  const availableEnquiries = enquiries.filter((entry) => !["WON", "LOST"].includes(entry.status));
  return (
    <div className="page-grid">
      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">QUOTATIONS</p><h2>Create a quotation</h2></div></div>
        <form className="form-grid" onSubmit={createQuotation}>
          <label>Enquiry
            <select value={enquiryId} onChange={(event) => setEnquiryId(event.target.value)} required>
              <option value="">Choose an enquiry</option>
              {availableEnquiries.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.enquiryNumber} — {entry.customer.companyName}</option>
              ))}
            </select>
          </label>
          <label>Valid until
            <input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required />
          </label>
          <button disabled={busyId === "create" || !availableEnquiries.length} type="submit">
            {busyId === "create" ? "Creating..." : "Create draft quotation"}
          </button>
        </form>
        <Feedback error={error} success={success} />
      </section>

      <section className="card table-card">
        <div className="section-heading"><div><p className="eyebrow">QUOTE REGISTER</p><h2>Quotations</h2></div></div>
        {!quotations.length ? <EmptyState>No quotations yet.</EmptyState> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Number</th><th>Customer</th><th>Enquiry</th><th>Grand total</th><th>Valid until</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{quotations.map((quotation) => (
              <tr key={quotation.id}>
                <td className="mono">{quotation.quotationNumber}</td>
                <td>{quotation.customer.companyName}</td>
                <td className="mono">{quotation.enquiry.enquiryNumber}</td>
                <td>{formatMoney(quotation.grandTotal)}</td>
                <td>{String(quotation.validUntil).slice(0, 10)}</td>
                <td><span className={`badge ${quotation.status.toLowerCase()}`}>{quotation.status}</span></td>
                <td><div className="action-row">
                  {quotation.status === "DRAFT" && <button className="button-small" disabled={busyId === quotation.id} onClick={() => changeStatus(quotation, "SENT")}>Mark sent</button>}
                  {quotation.status === "SENT" && <>
                    <button className="button-small" disabled={busyId === quotation.id} onClick={() => changeStatus(quotation, "ACCEPTED")}>Accept</button>
                    <button className="button-small secondary" disabled={busyId === quotation.id} onClick={() => changeStatus(quotation, "REJECTED")}>Reject</button>
                  </>}
                  {quotation.status === "ACCEPTED" && !quotation.salesOrder && <button className="button-small" disabled={busyId === quotation.id} onClick={() => convert(quotation)}>Convert to order</button>}
                  {quotation.salesOrder && <span className="muted mono">{quotation.salesOrder.orderNumber}</span>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
