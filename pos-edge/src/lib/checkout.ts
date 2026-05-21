import { db } from './db';
import type { CartItem } from '../store/cartStore';

function generateOrderNumber(storeCode: string) {
  // Format: {STORE_CODE}-{YYYYMMDD}-{XXXX}
  const date = new Date();
  const dateString = date.getFullYear().toString() + 
    (date.getMonth() + 1).toString().padStart(2, '0') + 
    date.getDate().toString().padStart(2, '0');
  
  // Use a random 4-digit string for MVP, 
  // In real app, we'd query SQLite for the max sequence number of today
  const seq = Math.floor(1000 + Math.random() * 9000).toString();
  
  return `${storeCode}-${dateString}-${seq}`;
}

function generateUUID() {
  return crypto.randomUUID();
}

export async function processCheckout(
  cartItems: CartItem[], 
  storeId: string, 
  tenantId: string, 
  paymentMethod: string = 'cash',
  tableId?: string
) {
  if (cartItems.length === 0) throw new Error('Cart is empty');

  // We should ideally fetch the store code to make a nice order number
  const storeRes = await db.sql`SELECT store_code FROM stores WHERE id = ${storeId}`;
  const storeCode = storeRes.length > 0 ? storeRes[0].store_code : 'M00';

  const orderId = generateUUID();
  const orderNumber = generateOrderNumber(storeCode);
  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const createdAt = new Date().toISOString();

  try {
    // We execute sequentially because SQLocal currently simulates transactions 
    // over postMessage. If any fail, it throws.
    
    // 1. Handle Order (Update existing unpaid or insert new)
    let finalOrderId = orderId;
    let finalOrderNumber = orderNumber;

    if (tableId) {
      // Check if there's an existing unpaid order
      const existing = await db.sql`SELECT id, order_number FROM orders WHERE table_id = ${tableId} AND pay_status = 'unpaid' AND status != 'voided'`;
      if (existing.length > 0) {
        finalOrderId = existing[0].id;
        finalOrderNumber = existing[0].order_number;
        // Update to paid
        await db.sql`UPDATE orders SET status = 'completed', pay_status = 'paid', total_amount = total_amount + ${totalAmount}, synced_at = null WHERE id = ${finalOrderId}`;
      } else {
        await db.sql`
          INSERT INTO orders (id, tenant_id, store_id, order_number, type, status, pay_status, total_amount, created_at, synced_at, table_id)
          VALUES (${finalOrderId}, ${tenantId}, ${storeId}, ${finalOrderNumber}, 'dine_in', 'completed', 'paid', ${totalAmount}, ${createdAt}, null, ${tableId})
        `;
      }
    } else {
      await db.sql`
        INSERT INTO orders (id, tenant_id, store_id, order_number, type, status, pay_status, total_amount, created_at, synced_at)
        VALUES (${finalOrderId}, ${tenantId}, ${storeId}, ${finalOrderNumber}, 'dine_in', 'completed', 'paid', ${totalAmount}, ${createdAt}, null)
      `;
    }

    // 2. Insert Order Items
    for (const item of cartItems) {
      const itemId = generateUUID();
      const snapshot = JSON.stringify({
        name: item.product_name,
        price: item.unit_price,
        modifiers: item.modifiers
      });
      
      await db.sql`
        INSERT INTO order_items (id, order_id, product_id, snapshot, quantity, subtotal)
        VALUES (${itemId}, ${finalOrderId}, ${item.product_id}, ${snapshot}, ${item.quantity}, ${item.subtotal})
      `;
    }

    // 3. Insert Payment Record
    const paymentId = generateUUID();
    await db.sql`
      INSERT INTO payment_records (id, order_id, payment_method, amount, created_at)
      VALUES (${paymentId}, ${finalOrderId}, ${paymentMethod}, ${totalAmount}, ${createdAt})
    `;

    return { success: true, orderId: finalOrderId, orderNumber: finalOrderNumber };
  } catch (error) {
    console.error('Checkout failed:', error);
    throw new Error('Failed to save order locally');
  }
}

export async function processUnpaidOrder(
  cartItems: CartItem[], 
  storeId: string, 
  tenantId: string, 
  tableId: string
) {
  if (cartItems.length === 0) throw new Error('Cart is empty');

  const storeRes = await db.sql`SELECT store_code FROM stores WHERE id = ${storeId}`;
  const storeCode = storeRes.length > 0 ? storeRes[0].store_code : 'M00';

  let orderId = generateUUID();
  let orderNumber = generateOrderNumber(storeCode);
  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const createdAt = new Date().toISOString();

  try {
    // Check if there's an existing unpaid order
    const existing = await db.sql`SELECT id, order_number FROM orders WHERE table_id = ${tableId} AND pay_status = 'unpaid' AND status != 'voided'`;
    
    if (existing.length > 0) {
      orderId = existing[0].id;
      orderNumber = existing[0].order_number;
      await db.sql`UPDATE orders SET total_amount = total_amount + ${totalAmount}, synced_at = null WHERE id = ${orderId}`;
    } else {
      await db.sql`
        INSERT INTO orders (id, tenant_id, store_id, order_number, type, status, pay_status, total_amount, created_at, synced_at, table_id)
        VALUES (${orderId}, ${tenantId}, ${storeId}, ${orderNumber}, 'dine_in', 'preparing', 'unpaid', ${totalAmount}, ${createdAt}, null, ${tableId})
      `;
    }

    // Insert Items
    for (const item of cartItems) {
      const itemId = generateUUID();
      const snapshot = JSON.stringify({
        name: item.product_name,
        price: item.unit_price,
        modifiers: item.modifiers
      });
      
      await db.sql`
        INSERT INTO order_items (id, order_id, product_id, snapshot, quantity, subtotal)
        VALUES (${itemId}, ${orderId}, ${item.product_id}, ${snapshot}, ${item.quantity}, ${item.subtotal})
      `;
    }

    return { success: true, orderId, orderNumber };
  } catch (error) {
    console.error('Send to kitchen failed:', error);
    throw new Error('Failed to send order to kitchen');
  }
}
