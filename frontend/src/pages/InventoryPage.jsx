import { useEffect, useState } from "react";
import { EmptyState, Feedback, Loading } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";

export default function InventoryPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/inventory");
      setInventory(result.inventory);
      setQuantities(Object.fromEntries(result.inventory.map((record) => [record.productId, record.physicalQuantity])));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function update(record) {
    const physicalQuantity = Number(quantities[record.productId]);
    if (!Number.isInteger(physicalQuantity) || physicalQuantity < record.reservedQuantity) {
      setError(`Physical quantity must be an integer at least equal to reserved stock (${record.reservedQuantity}).`);
      return;
    }
    setBusyId(record.productId);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/inventory/${record.productId}`, {
        method: "PATCH",
        body: JSON.stringify({ physicalQuantity })
      });
      await load();
      setSuccess(`Stock updated for ${record.product.productCode}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <Loading />;
  return (
    <section className="card table-card">
      <div className="section-heading"><div><p className="eyebrow">STOCK CONTROL</p><h2>Inventory</h2></div></div>
      <p className="muted">Available = physical − reserved. Reservations do not reduce physical stock; dispatch does.</p>
      <Feedback error={error} success={success} />
      {!inventory.length ? <EmptyState>No inventory records.</EmptyState> : (
        <div className="table-scroll"><table>
          <thead><tr><th>Product code</th><th>Product name</th><th>Category</th><th>Physical quantity</th><th>Reserved quantity</th><th>Available quantity</th>{user.role === "ADMIN" && <th>Adjust physical</th>}</tr></thead>
          <tbody>{inventory.map((record) => (
            <tr key={record.id}>
              <td className="mono">{record.product.productCode}</td>
              <td>{record.product.productName}</td>
              <td>{record.product.category}</td>
              <td>{record.physicalQuantity}</td>
              <td>{record.reservedQuantity}</td>
              <td><strong>{record.availableQuantity}</strong></td>
              {user.role === "ADMIN" && <td>
                <div className="inline-form">
                  <input
                    aria-label={`Physical quantity for ${record.product.productCode}`}
                    type="number"
                    min={record.reservedQuantity}
                    step="1"
                    required
                    value={quantities[record.productId] ?? ""}
                    onChange={(event) => setQuantities((current) => ({ ...current, [record.productId]: event.target.value }))}
                  />
                  <button
                    className="button-small"
                    disabled={busyId === record.productId || String(quantities[record.productId] ?? "").trim() === "" || !Number.isInteger(Number(quantities[record.productId])) || Number(quantities[record.productId]) < record.reservedQuantity}
                    onClick={() => update(record)}
                  >
                    Save
                  </button>
                </div>
              </td>}
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
