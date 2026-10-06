import { useEffect, useState } from "react";
import { EmptyState, Feedback, Loading } from "../components/Feedback";
import { apiRequest } from "../services/api";

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [productResult, inventoryResult, orderResult] = await Promise.all([
          apiRequest("/products"),
          apiRequest("/inventory"),
          apiRequest("/sales-orders")
        ]);
        setSummary({
          totalProducts: productResult.products.length,
          availableStock: inventoryResult.inventory.reduce((total, item) => total + item.availableQuantity, 0),
          reservedStock: inventoryResult.inventory.reduce((total, item) => total + item.reservedQuantity, 0),
          pendingOrders: orderResult.salesOrders.filter((order) => order.status === "PENDING").length
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
      <div className="section-heading"><div><p className="eyebrow">OPERATIONS SUMMARY</p><h2>Admin overview</h2></div></div>
      <Feedback error={error} />
      {!summary ? <EmptyState>Overview data is unavailable.</EmptyState> : (
        <div className="stat-grid">
          <article className="stat-card"><span>Total Products</span><strong>{summary.totalProducts}</strong></article>
          <article className="stat-card"><span>Available Stock</span><strong>{summary.availableStock}</strong></article>
          <article className="stat-card"><span>Reserved Stock</span><strong>{summary.reservedStock}</strong></article>
          <article className="stat-card"><span>Pending Sales Orders</span><strong>{summary.pendingOrders}</strong></article>
        </div>
      )}
    </section>
  );
}
