import { useEffect, useState } from "react";
import { EmptyState, Feedback, Loading } from "../components/Feedback";
import { apiRequest } from "../services/api";

export default function SalesDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [customerResult, enquiryResult, quotationResult, orderResult] = await Promise.all([
          apiRequest("/customers"),
          apiRequest("/enquiries"),
          apiRequest("/quotations"),
          apiRequest("/sales-orders")
        ]);
        setSummary({
          customers: customerResult.customers.length,
          enquiries: enquiryResult.enquiries.length,
          quotations: quotationResult.quotations.length,
          salesOrders: orderResult.salesOrders.length
        });
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SALES WORKSPACE</p>
          <h2>Sales activity</h2>
          <p className="muted">A snapshot of your customers and sales workflow.</p>
        </div>
      </div>
      <Feedback error={error} />
      {!summary ? <EmptyState>Sales dashboard data is unavailable.</EmptyState> : (
        <div className="stat-grid">
          <article className="stat-card"><span>Customers</span><strong>{summary.customers}</strong></article>
          <article className="stat-card"><span>Enquiries</span><strong>{summary.enquiries}</strong></article>
          <article className="stat-card"><span>Quotations</span><strong>{summary.quotations}</strong></article>
          <article className="stat-card"><span>Sales Orders</span><strong>{summary.salesOrders}</strong></article>
        </div>
      )}
    </section>
  );
}
