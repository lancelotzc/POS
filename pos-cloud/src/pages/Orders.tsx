import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Eye, Filter, RefreshCw, X } from 'lucide-react';

export default function Orders() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Filters
  const [filterStore, setFilterStore] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [stores, setStores] = useState<any[]>([]);

  useEffect(() => {
    fetchStores();
    fetchOrders();
  }, [filterDate, filterStore]);

  const fetchStores = async () => {
    let query = supabase.from('stores').select('id, name');
    if (!isSuperAdmin) {
      query = query.eq('tenant_id', profile?.tenant_id);
    }
    const { data } = await query;
    if (data) setStores(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*, stores(name)');
    
    if (!isSuperAdmin) {
      query = query.eq('tenant_id', profile?.tenant_id);
    }
    if (filterStore) {
      query = query.eq('store_id', filterStore);
    }
    if (filterDate) {
      // Need to filter by date part of created_at
      const start = new Date(filterDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filterDate);
      end.setHours(23, 59, 59, 999);
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    }

    query = query.order('created_at', { ascending: false }).limit(100);

    const { data, error } = await query;
    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const fetchOrderItems = async (orderId: string) => {
    setItemsLoading(true);
    const { data, error } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    if (!error && data) {
      setOrderItems(data);
    }
    setItemsLoading(false);
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    fetchOrderItems(order.id);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>訂單總覽</h2>
        <button onClick={fetchOrders} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} /> 重新整理
        </button>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: 'var(--bg-app)', padding: '15px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>日期</label>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>門店</label>
          <select 
            value={filterStore} 
            onChange={e => setFilterStore(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}
          >
            <option value="">全部門店</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>訂單編號</th>
                <th>時間</th>
                <th>門店</th>
                <th>類型</th>
                <th>總金額</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>無訂單資料</td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: '600' }}>{order.order_number}</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.stores?.name}</td>
                    <td>{order.type === 'dine_in' ? '內用' : order.type}</td>
                    <td style={{ color: order.status === 'voided' ? 'var(--text-secondary)' : '#3b82f6', textDecoration: order.status === 'voided' ? 'line-through' : 'none' }}>
                      ${order.total_amount}
                    </td>
                    <td>
                      {order.status === 'voided' ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>已作廢</span>
                      ) : (
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>完成</span>
                      )}
                    </td>
                    <td>
                      <button onClick={() => handleViewOrder(order)} className="action-btn view-btn" title="查看明細">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-app)', width: '100%', maxWidth: '600px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sidebar)' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>訂單明細</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{selectedOrder.order_number}</div>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', background: 'var(--bg-sidebar)', padding: '15px', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>門店</div>
                  <div style={{ fontWeight: '500' }}>{selectedOrder.stores?.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>時間</div>
                  <div style={{ fontWeight: '500' }}>{formatDate(selectedOrder.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>支付狀態</div>
                  <div style={{ fontWeight: '500' }}>{selectedOrder.pay_status}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>總計金額</div>
                  <div style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '1.2rem' }}>${selectedOrder.total_amount}</div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>商品列表</h4>
              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>載入中...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {orderItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div>
                        <span style={{ fontWeight: '500' }}>{item.quantity}x {item.snapshot?.name}</span>
                        {item.snapshot?.modifiers?.length > 0 && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '20px', marginTop: '4px' }}>
                            {item.snapshot.modifiers.map((m: any) => m.option_name).join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: '600' }}>${item.subtotal}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
