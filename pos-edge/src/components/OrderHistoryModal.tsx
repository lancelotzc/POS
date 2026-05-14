import { useState, useEffect } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { db } from '../lib/db';

interface OrderHistoryModalProps {
  onClose: () => void;
}

export default function OrderHistoryModal({ onClose }: OrderHistoryModalProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Fetch orders sorted by newest first
      const ordersData = await db.sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 50`;
      setOrders(ordersData);

      // Fetch items for these orders
      if (ordersData.length > 0) {
        const orderIds = ordersData.map(o => `'${o.id}'`).join(',');
        // SQLocal query with raw string might be tricky, better to query all or use IN with loop
        // Since it's a local SQLite, querying all order_items and filtering is fast enough for 50 orders
        const itemsData = await db.sql`SELECT * FROM order_items`;
        
        const itemsMap: Record<string, any[]> = {};
        itemsData.forEach(item => {
          if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
          
          let snapshot = {};
          try { snapshot = JSON.parse(item.snapshot); } catch (e) {}
          
          itemsMap[item.order_id].push({
            ...item,
            snapshot
          });
        });
        
        setOrderItems(itemsMap);
      }
    } catch (err) {
      console.error('Failed to fetch order history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVoidOrder = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`確定要作廢訂單 ${orderNumber} 嗎？此動作將會同步至雲端且無法還原。`)) {
      return;
    }

    try {
      setProcessingId(orderId);
      // Set status to voided, and clear synced_at to trigger background sync again
      await db.sql`
        UPDATE orders 
        SET status = 'voided', synced_at = null 
        WHERE id = ${orderId}
      `;
      // Refresh list
      await fetchOrders();
    } catch (err) {
      console.error('Failed to void order:', err);
      alert('作廢失敗');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} (${d.getMonth()+1}/${d.getDate()})`;
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--bg-app)', width: '100%', maxWidth: '800px', height: '80vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sidebar)' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>歷史訂單</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '50px' }}>載入中...</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '50px' }}>尚無交易紀錄</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {orders.map(order => (
                <div key={order.id} style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {order.order_number}
                        {order.status === 'voided' && (
                          <span style={{ fontSize: '0.8rem', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>已作廢</span>
                        )}
                      </h3>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', gap: '15px' }}>
                        <span>{formatDate(order.created_at)}</span>
                        <span>{order.type === 'dine_in' ? '內用' : order.type}</span>
                        {order.synced_at ? (
                          <span style={{ color: '#10b981' }}>✓ 已同步</span>
                        ) : (
                          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={12} /> 等待同步</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: order.status === 'voided' ? 'var(--text-secondary)' : '#3b82f6', textDecoration: order.status === 'voided' ? 'line-through' : 'none' }}>
                        ${order.total_amount}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{order.pay_status}</div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div style={{ background: 'var(--bg-app)', padding: '15px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    {orderItems[order.id]?.map((item: any) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-primary)' }}>{item.quantity}x {item.snapshot?.name}</span>
                          {item.snapshot?.modifiers?.length > 0 && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '25px' }}>
                              {item.snapshot.modifiers.map((m: any) => m.option_name).join(', ')}
                            </div>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-primary)' }}>${item.subtotal}</div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  {order.status !== 'voided' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                      <button 
                        onClick={() => handleVoidOrder(order.id, order.order_number)}
                        disabled={processingId === order.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: processingId === order.id ? 'not-allowed' : 'pointer' }}
                      >
                        {processingId === order.id ? <RefreshCw size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                        作廢此單
                      </button>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
