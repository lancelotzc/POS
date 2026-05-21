import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Users, Clock } from 'lucide-react';

interface TableMapProps {
  onSelectTable: (tableId: string, tableName: string) => void;
}

export default function TableMap({ onSelectTable }: TableMapProps) {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTables();
    
    // Setup Realtime for tables (if we wanted multi-device sync, we would subscribe here)
    // For now, we just poll or fetch on mount since it's the edge
  }, []);

  const fetchTables = async () => {
    setLoading(true);
    const storeId = localStorage.getItem('pos_store_id');
    if (!storeId) return;

    try {
      // In a real app, table statuses might be updated via Realtime or background sync
      // We fetch the tables and their active unpaid orders
      const { data: tableData, error } = await supabase
        .from('tables')
        .select('*')
        .eq('store_id', storeId)
        .order('name');
        
      if (error) throw error;
      
      // Fetch active orders for these tables
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, table_id, total_amount, created_at')
        .eq('store_id', storeId)
        .eq('pay_status', 'unpaid')
        .neq('status', 'voided');

      // Map active orders to tables
      const mappedTables = tableData.map(t => {
        const order = activeOrders?.find(o => o.table_id === t.id);
        return {
          ...t,
          activeOrder: order
        };
      });

      setTables(mappedTables);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = (createdStr: string) => {
    const diffMs = new Date().getTime() - new Date(createdStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <RefreshCw size={32} className="animate-spin" color="var(--text-secondary)" />
        <div style={{ color: 'var(--text-secondary)' }}>載入桌況中...</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: '30px', background: 'var(--bg-app)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>桌況總覽 (Table Map)</h2>
        <button onClick={fetchTables} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} /> 更新桌況
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
        {tables.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}>
            尚未設定任何桌次，請先至雲端後台設定
          </div>
        ) : (
          tables.map(table => {
            const isOccupied = !!table.activeOrder;
            
            return (
              <div 
                key={table.id}
                onClick={() => onSelectTable(table.id, table.name)}
                style={{ 
                  height: '160px', 
                  borderRadius: '16px', 
                  padding: '20px', 
                  cursor: 'pointer',
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  border: isOccupied ? '2px solid #ef4444' : '2px solid #10b981',
                  background: isOccupied ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                  transition: 'transform 0.1s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: isOccupied ? '#ef4444' : '#10b981' }}>
                    {table.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '6px' }}>
                    <Users size={14} /> {table.capacity}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  {isOccupied ? (
                    <>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        ${table.activeOrder.total_amount}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#f59e0b', marginTop: '5px' }}>
                        <Clock size={12} /> 用餐中 ({calculateDuration(table.activeOrder.created_at)})
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '1.1rem', color: '#10b981', fontWeight: '500' }}>空桌 (Idle)</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
