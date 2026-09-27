import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Checkout.css";
import YocoPayment from "../components/YocoPayment";

const CART_KEY = "ict_branded_cart";
const USER_KEY = "ict_branded_user";
const DISCOUNT = 0.2;
const API_URL = import.meta.env.VITE_API_URL;
const BANKS = ["FNB", "Standard Bank", "ABSA", "Nedbank", "Capitec"];
const PAYMENT_METHODS = ["YOCO", "SnapScan", "EFT", "QR Scan"];
const RESIDENCE_GROUPS = [
  { label: "Bellville Campus", options: ["Bellville Campus Residences", "Anglo American Residence", "De Beers Residence (East Wing)", "De Goede Hoop Residence", "Freedom Square 1 & 2", "Heroes House", "Kruskal", "MGR 1", "MGR 2", "New 200 Beds Residence", "Post Graduate Residence", "Richard Sacco / Sacco Residence", "Sheriff's House Residence", "Toplin House", "Park Central", "Theresa Court", "Toplin 2", "Bellpark", "Reghkam", "South Point – Orchards", "Student Life – Northville", "Melade House", "Student Junction Residences (Goodman, Libertas, Le Ruth, Middestad, Picton)", "Elile House"] },
  { label: "District Six (Cape Town) Campus", options: ["Cape Suites", "Catsville (Groote Schuur)", "City Edge Residence", "Downtown Lodge (Zonnebloem)", "Elizabeth Women's Residence (Gardens)", "J&B Residence (Zonnebloem)", "New Market Junction", "Plein Street (South Point)", "President House (South Point)", "Sandenburgh Residence (Zonnebloem)", "St Peters Residence – Block A", "Hanover Street Residence", "Vogue House", "Stanhope – South Point", "Harfield", "Rushkin House", "Mountain House"] },
  { label: "Mowbray Campus", options: ["Viljoenhof Residence"] },
  { label: "Wellington Campus", options: ["House Bliss", "House Meiring", "Murray House", "House Navarre", "New Navarre", "Wouter Malan"] },
  { label: "Accredited Off-Campus (CPUT-approved)", options: ["Van Riebeck", "St Monica's", "Belle Cape", "Premier House", "Cape Station", "Imizamo", "F&S", "Khasia House", "Usenathi"] },
];

const money = (n) => "R" + (n % 1 === 0? n : n.toFixed(2));
const getStudentNumber = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null")?.studentNumber; } catch { return undefined; } };
const getLoggedInUserId = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null")?.id; } catch { return undefined; } };
const fieldLabelStyle = { fontSize: "0.85rem", fontWeight: 600, color: "#334155" };
const fieldStyle = { width: "100%", padding: "10px", marginTop: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", boxSizing: "border-box" };

function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({});
  const [catalog, setCatalog] = useState({});
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [delivery, setDelivery] = useState("courier");
  const [residence, setResidence] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [paxiPoint, setPaxiPoint] = useState("");
  const [payment, setPayment] = useState("YOCO");
  const [selectedBank, setSelectedBank] = useState(BANKS[0]);
  const [confirmation, setConfirmation] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [qrData, setQrData] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => { try { const raw = localStorage.getItem(CART_KEY); if (raw) setCart(JSON.parse(raw)); } catch (e) { console.error("Failed to load cart", e); } }, []);
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch(`${API_URL}/api/item`);
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        const map = {}; data.forEach((item) => { map[item.id] = { name: item.name, sub: item.category?.name || "", price: item.price }; });
        setCatalog(map);
      } catch (err) { console.error("Failed to fetch catalog", err); } finally { setLoadingCatalog(false); }
    }; fetchCatalog();
  }, []);
  useEffect(() => {
    const handleStorage = (e) => { if (e.key === CART_KEY &&!confirmation) { try { setCart(e.newValue? JSON.parse(e.newValue) : {}); } catch (err) { console.error(err); } } };
    window.addEventListener("storage", handleStorage); return () => window.removeEventListener("storage", handleStorage);
  }, [confirmation]);

  useEffect(() => {
    if (showScanner) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => { streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(() => { setOrderError("Camera permission denied. Please allow camera."); setShowScanner(false); });
    } else {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    }
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, [showScanner]);

  const saveCart = (newCart) => { setCart(newCart); localStorage.setItem(CART_KEY, JSON.stringify(newCart)); };
  const items = Object.keys(cart).filter(k => cart[k] > 0 && catalog[k.split("::")[0]]).map(k => {
    const [id, size] = k.split("::"); const p = catalog[id]; const qty = cart[k];
    return { id: k, qty, name: size? `${p.name} (${size})` : p.name, sub: p.sub, price: p.price, origLineTotal: p.price * qty, lineTotal: Math.round(p.price * (1 - DISCOUNT)) * qty };
  });
  const updateQty = (id, q) => { const u = {...cart }; if (q <= 0) delete u[id]; else u[id] = q; saveCart(u); };
  const removeItem = (id) => { const u = {...cart }; delete u[id]; saveCart(u); };
  const subtotal = items.reduce((s, i) => s + i.origLineTotal, 0);
  const discountAmount = Math.round(subtotal * DISCOUNT);
  const total = subtotal - discountAmount;
  const deliveryValid = (delivery === "courier" && residence!== "" && roomNumber.trim()!== "") || (delivery === "paxi" && paxiPoint.trim()!== "");
  const deliveryHint = delivery === "courier"? "Select your residence and enter your room number." : "Enter your PAXI pickup point.";
  const getDeliverySummary = () => delivery === "courier"? `${residence}, room ${roomNumber.trim()}` : `PAXI – ${paxiPoint.trim()}`;

  const placeOrder = async () => {
    if (placingOrder) return;
    if (!deliveryValid) { setOrderError(deliveryHint); return; }
    if ((payment === "QR Scan" || payment === "SnapScan") &&!qrScanned) { setOrderError("Please scan QR code first!"); return; }
    setPlacingOrder(true); setOrderError(null);
    try {
      const results = await Promise.all(items.map(item => fetch(`${API_URL}/api/invoice`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: crypto.randomUUID(), receipt: { itemName: item.name, price: item.price, quantity: item.qty, subtotal: item.origLineTotal, serviceFee: 0, total: item.lineTotal, userId: getLoggedInUserId(), deliveryType: delivery, deliverySummary: getDeliverySummary() } })
      })));
      if (results.some(r =>!r.ok)) throw new Error("Invoice failed");
      setConfirmation({ total, payment, deliverySummary: getDeliverySummary() });
      saveCart({});
    } catch (err) { setOrderError("Failed to place order. Try again."); } finally { setPlacingOrder(false); }
  };

  const payLabel = payment === "EFT"? `Pay ${money(total)} via EFT – ${selectedBank}` : payment === "QR Scan"? `Pay ${money(total)} via QR Scan` : `Pay ${money(total)} with ${payment}`;

  return (
    <div className="checkout-container">
      <nav className="checkout-nav"><Link className="nav-back" to="/products">← Back to Shop</Link><span className="nav-title">Checkout</span><span className="nav-logo">Item<span>Hive</span></span></nav>
      <div className="checkout-page">
        {confirmation? (
          <div className="confirm-card"><div className="confirm-emoji">🎉</div><div className="confirm-title">Order Placed!</div><div className="confirm-detail">Total: <strong>{money(confirmation.total)}</strong> via {confirmation.payment}</div><div className="confirm-detail">Delivery: <strong>{confirmation.deliverySummary}</strong></div><button className="confirm-btn" onClick={() => navigate("/products")}>Continue Shopping</button></div>
        ) : loadingCatalog? (
          <div className="empty-state"><div className="empty-title">Loading...</div></div>
        ) : items.length === 0? (
          <div className="empty-state"><div className="empty-emoji">🛒</div><div className="empty-title">Cart empty</div><button className="empty-btn" onClick={() => navigate("/products")}>Browse Products</button></div>
        ) : (
          <>
            <div className="student-banner"><div className="banner-badge">-20% OFF</div><div>Student discount applied!</div></div>
            <div className="card"><div className="card-head">Order Summary</div><div className="card-body">
              {items.map(item => (<div className="order-item" key={item.id}><div className="item-left"><div><div className="item-name">{item.name}</div><div className="item-sub">{item.sub}</div></div></div><div className="qty-controls"><button className="qty-btn" onClick={() => updateQty(item.id, item.qty - 1)}>−</button><span className="qty-val">{item.qty}</span><button className="qty-btn" onClick={() => updateQty(item.id, item.qty + 1)}>+</button></div><div className="item-price">{money(item.lineTotal)}</div><button className="remove-btn" onClick={() => removeItem(item.id)}>×</button></div>))}
            </div></div>

            <div className="card"><div className="card-head">Delivery / Pickup</div><div className="card-body">
              <div className="del-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div className={`del-opt ${delivery === "courier"? "active" : ""}`} onClick={() => setDelivery("courier")}><div className="del-name">Standard Delivery</div><div className="del-desc">Direct to residence</div><div className="del-price">FREE</div></div>
                <div className={`del-opt ${delivery === "paxi"? "active" : ""}`} onClick={() => setDelivery("paxi")}><div className="del-name">PAXI</div><div className="del-desc">PAXI pickup point</div><div className="del-price">FREE</div></div>
              </div>
              {delivery === "courier" && (<div style={{ marginTop: "14px" }}><label style={fieldLabelStyle}>Residence</label><select value={residence} onChange={e => setResidence(e.target.value)} style={fieldStyle}><option value="">Select residence</option>{RESIDENCE_GROUPS.map(g => (<optgroup key={g.label} label={g.label}>{g.options.map(r => (<option key={r} value={r}>{r}</option>))}</optgroup>))}</select><label style={{...fieldLabelStyle, display: "block", marginTop: "12px" }}>Room number</label><input type="text" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. 214" style={fieldStyle} /></div>)}
              {delivery === "paxi" && (<div style={{ marginTop: "14px" }}><label style={fieldLabelStyle}>PAXI pickup point</label><input type="text" value={paxiPoint} onChange={e => setPaxiPoint(e.target.value)} placeholder="Store name" style={fieldStyle} /><a href="https://www.paxi.co.za/paxi-point-locator" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: "8px", fontSize: "0.85rem", color: "#FF6B00", fontWeight: 600 }}>📍 Find nearest PAXI →</a></div>)}
            </div></div>

            <div className="card"><div className="card-head">Payment Method</div><div className="card-body">
              <div className="pay-row">{PAYMENT_METHODS.map(m => (<button key={m} className={`pay-opt ${payment === m? "active" : ""}`} onClick={() => { setPayment(m); setQrScanned(false); setShowScanner(false); }}>{m}</button>))}</div>
              {payment === "EFT" && (<div style={{ marginTop: "12px" }}><label style={fieldLabelStyle}>Select Bank</label><select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "6px", borderRadius: "8px" }}>{BANKS.map(b => (<option key={b} value={b}>{b}</option>))}</select></div>)}

              {(payment === "QR Scan" || payment === "SnapScan") && (
                <div style={{ marginTop: "16px", padding: "16px", border: "2px dashed #22c55e", borderRadius: "12px", background: "#f0fdf4", textAlign: "center" }}>
                  <h4 style={{ margin: "0 0 10px" }}>📱 Scan QR to Pay {money(total)}</h4>
                  {!showScanner &&!qrScanned && (<button onClick={() => setShowScanner(true)} style={{ padding: "12px 24px", background: "black", color: "white", borderRadius: "8px", border: "none", cursor: "pointer" }}>📷 Open QR Scanner</button>)}
                  {showScanner && (
                    <div>
                      <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "320px", height: "320px", background: "#000", borderRadius: "12px", objectFit: "cover" }} />
                      <div style={{ marginTop: "12px", display: "flex", gap: "10px", justifyContent: "center" }}>
                        <button onClick={() => { setQrData(`PAY-${Date.now()}-${total}`); setQrScanned(true); setShowScanner(false); }} style={{ padding: "10px 20px", background: "#22c55e", color: "white", borderRadius: "8px", border: "none" }}>✅ Confirm Scan</button>
                        <button onClick={() => setShowScanner(false)} style={{ padding: "10px 20px", background: "#e2e8f0", borderRadius: "8px", border: "none" }}>Close</button>
                      </div>
                    </div>
                  )}
                  {qrScanned && (<div style={{ background: "white", padding: "12px", borderRadius: "8px", marginTop: "10px", border: "1px solid #22c55e" }}><div style={{ color: "#16a34a", fontWeight: "700" }}>✅ QR Scanned!</div><div style={{ fontSize: "12px", fontFamily: "monospace", background: "#f1f5f9", padding: "6px", borderRadius: "4px", marginTop: "6px" }}>{qrData}</div><button onClick={() => { setQrScanned(false); setQrData(""); }} style={{ marginTop: "8px", fontSize: "12px", background: "none", border: "none", textDecoration: "underline" }}>Scan Again</button></div>)}
                </div>
              )}
            </div></div>

            <div className="card"><div className="card-head">Price Breakdown</div><div className="card-body">
              {items.map(item => (<div className="total-row" key={item.id}><span>{item.name} {item.qty > 1? `× ${item.qty}` : ""}</span><span>{money(item.origLineTotal)}</span></div>))}
              <div className="total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="total-row discount"><span>Student Discount <span className="disc-badge">-20%</span></span><span>-{money(discountAmount)}</span></div>
              <div className="total-row final"><span>Total</span><span>{money(total)}</span></div>
            </div></div>

            {orderError && (<p style={{ color: "red", textAlign: "center" }}>{orderError}</p>)}
            {!deliveryValid && (<p style={{ color: "#64748B", textAlign: "center", fontSize: "0.85rem" }}>{deliveryHint}</p>)}

            <div style={{ marginTop: "20px" }}>
              {payment === "YOCO"? (<YocoPayment amount={total} studentNumber={getStudentNumber()} deliverySummary={getDeliverySummary()} disabled={placingOrder ||!deliveryValid} buttonClassName="order-btn" onSuccess={placeOrder} />) : (
                <button className="order-btn" onClick={placeOrder} disabled={placingOrder ||!deliveryValid || ((payment === "QR Scan" || payment === "SnapScan") &&!qrScanned)} style={{ width: "100%", opacity: ((payment === "QR Scan" || payment === "SnapScan") &&!qrScanned)? 0.6 : 1 }}>{placingOrder? "Placing..." : payLabel}</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export default Checkout;
