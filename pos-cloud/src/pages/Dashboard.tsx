import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, ShoppingBag, TrendingUp, Store as StoreIcon, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    todayOrders: 0,
    monthSales: 0,
    storeRanking: [] as any[]
  });

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStr = firstDayOfMonth.toISOString();

      // Get Today's Orders
      let queryToday = supabase.from('orders').select('total_amount, store_id, stores(name)').gte('created_at', todayStr).neq('status', 'voided');
      if (!isSuperAdmin) queryToday = queryToday.eq('tenant_id', profile.tenant_id);
      
      const { data: todayData } = await queryToday;

      // Get Month's Orders
      let queryMonth = supabase.from('orders').select('total_amount').gte('created_at', monthStr).neq('status', 'voided');
      if (!isSuperAdmin) queryMonth = queryMonth.eq('tenant_id', profile.tenant_id);
      
      const { data: monthData } = await queryMonth;

      let tSales = 0;
      let tOrders = 0;
      const storeSales: Record<string, {name: string, sales: number, orders: number}> = {};

      if (todayData) {
        tOrders = todayData.length;
        todayData.forEach((order: any) => {
          tSales += Number(order.total_amount);
          const sId = order.store_id;
          if (!storeSales[sId]) {
            storeSales[sId] = { name: order.stores?.name || '未知門店', sales: 0, orders: 0 };
          }
          storeSales[sId].sales += Number(order.total_amount);
          storeSales[sId].orders += 1;
        });
      }

      let mSales = 0;
      if (monthData) {
        monthData.forEach((order: any) => {
          mSales += Number(order.total_amount);
        });
      }

      const ranking = Object.values(storeSales).sort((a, b) => b.sales - a.sales);

      setMetrics({
        todaySales: tSales,
        todayOrders: tOrders,
        monthSales: mSales,
        storeRanking: ranking
      });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>戰情看板 (Dashboard)</h2>
        <button onClick={fetchDashboardData} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 重新整理
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '15px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={32} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '5px' }}>今日營業額</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              ${metrics.todaySales.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '15px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={32} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '5px' }}>今日訂單數</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {metrics.todayOrders.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>筆</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '15px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={32} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '5px' }}>本月累計營業額</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              ${metrics.monthSales.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Store Ranking */}
      <div className="card">
        <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StoreIcon size={20} color="#3b82f6" /> 門店今日業績排行
        </h3>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>分析中...</div>
        ) : metrics.storeRanking.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>今日尚無交易資料</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {metrics.storeRanking.map((store, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#b45309' : 'var(--bg-sidebar)', color: index <= 2 ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{store.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{store.orders} 筆訂單</div>
                  </div>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                  ${store.sales.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
