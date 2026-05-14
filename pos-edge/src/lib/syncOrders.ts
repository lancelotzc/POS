import { db } from './db';
import { supabase } from './supabase';

let isSyncingOrders = false;

export async function syncOfflineOrders() {
  if (isSyncingOrders) return;
  isSyncingOrders = true;

  try {
    // 1. Get all unsynced orders
    const ordersToSync = await db.sql`SELECT * FROM orders WHERE synced_at IS NULL`;
    if (ordersToSync.length === 0) {
      isSyncingOrders = false;
      return;
    }

    console.log(`Found ${ordersToSync.length} orders to sync to cloud...`);

    for (const order of ordersToSync) {
      // 2. Get related items and payments
      const orderItems = await db.sql`SELECT * FROM order_items WHERE order_id = ${order.id}`;
      const payments = await db.sql`SELECT * FROM payment_records WHERE order_id = ${order.id}`;

      // 3. Upload Order
      const { error: orderError } = await supabase.from('orders').insert({
        id: order.id,
        tenant_id: order.tenant_id,
        store_id: order.store_id,
        order_number: order.order_number,
        type: order.type,
        status: order.status,
        pay_status: order.pay_status,
        total_amount: order.total_amount,
        created_at: order.created_at
      });

      // If error is duplicate key, it means we somehow synced it before but local didn't get updated. 
      // It's safe to proceed. Otherwise, throw.
      if (orderError && orderError.code !== '23505') { 
        console.error(`Failed to sync order ${order.id}:`, orderError);
        continue; // Try next order
      }

      // 4. Upload Order Items
      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase.from('order_items').upsert(
          orderItems.map(item => ({
            id: item.id,
            order_id: item.order_id,
            product_id: item.product_id,
            snapshot: JSON.parse(item.snapshot),
            quantity: item.quantity,
            subtotal: item.subtotal
          }))
        );
        if (itemsError) {
          console.error(`Failed to sync order items for ${order.id}:`, itemsError);
          continue;
        }
      }

      // 5. Upload Payments
      if (payments.length > 0) {
        const { error: paymentError } = await supabase.from('payment_records').upsert(
          payments.map(p => ({
            id: p.id,
            order_id: p.order_id,
            payment_method: p.payment_method,
            amount: p.amount,
            created_at: p.created_at
          }))
        );
        if (paymentError) {
          console.error(`Failed to sync payments for ${order.id}:`, paymentError);
          continue;
        }
      }

      // 6. Mark as synced locally
      const syncTime = new Date().toISOString();
      await db.sql`UPDATE orders SET synced_at = ${syncTime} WHERE id = ${order.id}`;
      console.log(`Successfully synced order ${order.order_number}`);
    }

  } catch (err) {
    console.error('Background order sync failed:', err);
  } finally {
    isSyncingOrders = false;
  }
}

// Setup background timer (call this once on POS mount)
export function startBackgroundSync(intervalMs = 30000) {
  // Sync immediately once
  syncOfflineOrders();
  // Then start interval
  const timer = setInterval(syncOfflineOrders, intervalMs);
  return () => clearInterval(timer);
}
