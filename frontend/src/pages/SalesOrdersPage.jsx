import { useEffect, useState } from "react";
import { EmptyState, Feedback, Loading } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(amount));
}

export default function SalesOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [dispatchForm, setDispatchForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [orderResult, inventoryResult] = await Promise.all([
        apiRequest("/sales-orders"),
        apiRequest("/inventory")
      ]);
      setOrders(orderResult.salesOrders);
      setInventory(inventoryResult.inventory);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function confirm(order) {
    setBusyId(order.id);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/sales-orders/${order.id}/confirm`, { method: "POST", body: "{}" });
      await load();
      setSuccess(`${order.orderNumber} confirmed and stock reserved.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  async function dispatch(order) {
    const details = dispatchForm[order.id] || { vehicleNumber: "", driverName: "" };
    setBusyId(order.id);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest(`/sales-orders/${order.id}/dispatch`, {
        method: "POST",
        body: JSON.stringify(details)
      });
      await load();
      setSuccess(`${result.dispatch.dispatchNumber} dispatched. Inventory has been updated.`);
      setDispatchForm((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <Loading />;
  const stockByProduct = new Map(inventory.map((row) => [row.productId, row]));

  return (
    <div className="page-grid">
      <section className="card table-card">
        <div className="section-heading"><div><p className="eyebrow">ORDER MANAGEMENT</p><h2>Sales orders</h2></div></div>
        <Feedback error={error} success={success} />
        {!orders.length ? <EmptyState>No Sales Orders yet. Convert an accepted quotation first.</EmptyState> : (
          <div className="order-list">{orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-topline">
                <div>
                  <span className="eyebrow mono">{order.orderNumber}</span>
                  <h3>{order.customer.companyName}</h3>
                  <p className="muted">Quotation {order.quotation.quotationNumber} · {String(order.orderDate).slice(0, 10)}</p>
                </div>
                <div className="order-summary">
                  <strong>{formatMoney(order.totalAmount)}</strong>
                  <span className={`badge ${order.status.toLowerCase()}`}>{order.status}</span>
                </div>
              </div>
              <div className="table-scroll"><table>
                <thead><tr><th>Product</th><th>Quantity</th><th>Available now</th></tr></thead>
                <tbody>{order.items.map((item) => {
                  const stock = stockByProduct.get(item.productId);
                  return <tr key={item.id}>
                    <td>{item.product.productCode} — {item.product.productName}</td>
                    <td>{item.quantity} {item.product.unit}</td>
                    <td>{stock?.availableQuantity ?? "Not tracked"}</td>
                  </tr>;
                })}</tbody>
              </table></div>
              {user.role === "ADMIN" && order.status === "PENDING" && (
                <button disabled={busyId === order.id} onClick={() => confirm(order)}>
                  {busyId === order.id ? "Confirming..." : "Confirm and reserve stock"}
                </button>
              )}
              {user.role === "ADMIN" && order.status === "CONFIRMED" && (
                <div className="dispatch-panel">
                  <label>Vehicle number
                    <input
                      value={(dispatchForm[order.id] || {}).vehicleNumber || ""}
                      onChange={(event) => setDispatchForm((current) => ({
                        ...current,
                        [order.id]: { ...(current[order.id] || {}), vehicleNumber: event.target.value }
                      }))}
                      required
                    />
                  </label>
                  <label>Driver name
                    <input
                      value={(dispatchForm[order.id] || {}).driverName || ""}
                      onChange={(event) => setDispatchForm((current) => ({
                        ...current,
                        [order.id]: { ...(current[order.id] || {}), driverName: event.target.value }
                      }))}
                      required
                    />
                  </label>
                  <button
                    disabled={busyId === order.id || !(dispatchForm[order.id] || {}).vehicleNumber || !(dispatchForm[order.id] || {}).driverName}
                    onClick={() => dispatch(order)}
                  >
                    {busyId === order.id ? "Dispatching..." : "Dispatch full order"}
                  </button>
                </div>
              )}
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
