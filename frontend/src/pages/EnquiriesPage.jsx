import { useEffect, useState } from "react";
import { EmptyState, Feedback, Loading } from "../components/Feedback";
import { apiRequest } from "../services/api";

const blankCustomer = {
  companyName: "",
  contactPerson: "",
  mobile: "",
  email: "",
  city: ""
};

export default function EnquiriesPage() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [customer, setCustomer] = useState(blankCustomer);
  const [customerId, setCustomerId] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [customerResult, productResult, enquiryResult] = await Promise.all([
        apiRequest("/customers"),
        apiRequest("/products"),
        apiRequest("/enquiries")
      ]);
      setCustomers(customerResult.customers);
      setProducts(productResult.products);
      setEnquiries(enquiryResult.enquiries);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createCustomer(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest("/customers", {
        method: "POST",
        body: JSON.stringify(customer)
      });
      setCustomers((current) => [...current, result.customer]);
      setCustomerId(result.customer.id);
      setCustomer(blankCustomer);
      setSuccess(`Customer ${result.customer.companyName} created.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function createEnquiry(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const items = Object.entries(selected)
      .filter(([, row]) => row.checked)
      .map(([productId, row]) => ({ productId, quantity: Number(row.quantity) }));

    try {
      const result = await apiRequest("/enquiries", {
        method: "POST",
        body: JSON.stringify({ customerId, requiredDate: requiredDate || undefined, notes, items })
      });
      setEnquiries((current) => [result.enquiry, ...current]);
      setSelected({});
      setRequiredDate("");
      setNotes("");
      setSuccess(`Enquiry ${result.enquiry.enquiryNumber} created.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(enquiry, status) {
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/enquiries/${enquiry.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
      setSuccess(`Enquiry marked ${status}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="page-grid">
      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">CUSTOMERS</p><h2>Create a customer</h2></div>
        </div>
        <form className="form-grid" onSubmit={createCustomer}>
          {Object.entries(customer).map(([field, value]) => (
            <label key={field}>
              {field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}
              <input
                type={field === "email" ? "email" : "text"}
                value={value}
                onChange={(event) => setCustomer((current) => ({ ...current, [field]: event.target.value }))}
                required
              />
            </label>
          ))}
          <button disabled={busy} type="submit">Create customer</button>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">SALES PIPELINE</p><h2>New enquiry</h2></div>
        </div>
        <form className="stack" onSubmit={createEnquiry}>
          <label>Customer
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
              <option value="">Choose a customer</option>
              {customers.map((entry) => <option key={entry.id} value={entry.id}>{entry.companyName}</option>)}
            </select>
          </label>
          <div className="form-grid">
            <label>Required date
              <input type="date" value={requiredDate} onChange={(event) => setRequiredDate(event.target.value)} />
            </label>
            <label>Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength="2000" />
            </label>
          </div>
          <fieldset className="product-picker">
            <legend>Requested products</legend>
            {products.map((product) => {
              const row = selected[product.id] || { checked: false, quantity: 1 };
              return (
                <div className="product-choice" key={product.id}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(event) => setSelected((current) => ({
                        ...current,
                        [product.id]: { ...row, checked: event.target.checked }
                      }))}
                    />
                    {product.productCode} — {product.productName}
                  </label>
                  <input
                    aria-label={`Quantity for ${product.productName}`}
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(event) => setSelected((current) => ({
                      ...current,
                      [product.id]: { ...row, quantity: event.target.value }
                    }))}
                  />
                </div>
              );
            })}
          </fieldset>
          <Feedback error={error} success={success} />
          <button disabled={busy || !customers.length} type="submit">{busy ? "Saving..." : "Create enquiry"}</button>
        </form>
      </section>

      <section className="card table-card">
        <div className="section-heading"><div><p className="eyebrow">ENQUIRIES</p><h2>Recent enquiries</h2></div></div>
        {!enquiries.length ? <EmptyState>No enquiries yet.</EmptyState> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Number</th><th>Customer</th><th>Enquiry date</th><th>Required</th><th>Products</th><th>Status</th><th></th></tr></thead>
            <tbody>{enquiries.map((enquiry) => (
              <tr key={enquiry.id}>
                <td className="mono">{enquiry.enquiryNumber}</td>
                <td>{enquiry.customer.companyName}</td>
                <td>{String(enquiry.enquiryDate).slice(0, 10)}</td>
                <td>{enquiry.requiredDate ? String(enquiry.requiredDate).slice(0, 10) : "—"}</td>
                <td>{enquiry.items.map((item) => `${item.product.productCode} × ${item.quantity}`).join(", ")}</td>
                <td><span className={`badge ${enquiry.status.toLowerCase()}`}>{enquiry.status}</span></td>
                <td>{["NEW", "QUOTED"].includes(enquiry.status) && (
                  <button className="button-small secondary" onClick={() => updateStatus(enquiry, "LOST")} type="button">Mark lost</button>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
