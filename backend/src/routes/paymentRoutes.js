/**
 * Payment Routes - Razorpay Integration
 * 
 * POST /api/payment/create-order  - Creates a Razorpay order for a bill
 * POST /api/payment/verify-payment - Verifies payment signature and marks bill as paid
 * GET  /api/payment/checkout/:orderId - Serves Razorpay web checkout HTML page (Expo Go compatible)
 */
const express = require('express');
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');
const razorpay = require('../config/razorpay');
const db = require('../config/db');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/create-order
// Creates a Razorpay order for the given bill
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { amount, billId } = req.body;

    if (!amount || !billId) {
      return res.status(400).json({ message: 'amount and billId are required' });
    }

    // Validate bill belongs to authenticated user
    const [bills] = await db.query(
      'SELECT bill_id, total_amount FROM bills WHERE bill_id = ? AND user_id = ?',
      [billId, req.user.userId]
    );

    if (!bills || bills.length === 0) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Create Razorpay order (amount must be in paise)
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `bill_${billId}_${Date.now()}`,
      notes: {
        billId: String(billId),
        userId: String(req.user.userId),
      },
    });

    // Save order record to DB and update bill with order_id and status
    await db.query(
      `UPDATE bills SET razorpay_order_id = ?, payment_status = 'pending' WHERE bill_id = ?`,
      [order.id, billId]
    );

    // Keep the payments table record for tracking history
    await db.query(
      `INSERT INTO payments (bill_id, order_id, amount, currency, status)
       VALUES (?, ?, ?, 'INR', 'created')`,
      [billId, order.id, parseFloat(amount)]
    );

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: 'Failed to create payment order', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/create-qr
// New endpoint for dynamic QR generation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-qr', authMiddleware, async (req, res) => {
  try {
    const { billId } = req.body;

    if (!billId) {
      return res.status(400).json({ message: 'billId is required' });
    }

    const [bills] = await db.query(
      'SELECT bill_id, total_amount FROM bills WHERE bill_id = ? AND user_id = ?',
      [billId, req.user.userId]
    );

    if (!bills || bills.length === 0) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const bill = bills[0];
    const amount = bill.total_amount;
    const amountInPaise = Math.round(amount * 100);

    // 2. Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `bill_${billId}_qr_${Date.now()}`,
      notes: { billId: String(billId) },
    });

    // 3. Update bill status to pending
    await db.query(
      `UPDATE bills SET payment_status = 'pending' WHERE bill_id = ?`,
      [billId]
    );

    // 4. Record the payment attempt in the payments table (matches your new schema)
    await db.query(
      `INSERT INTO payments (bill_id, order_id, amount, status) VALUES (?, ?, ?, 'created')`,
      [billId, order.id, amount]
    );

    res.json({
      order_id: order.id,
      amount: amount,
      upi_link: `upi://pay?pa=${process.env.RAZORPAY_KEY_ID}@razorpay&pn=PhotoBilling&am=${amount}&cu=INR&tr=${order.id}`,
    });
  } catch (err) {
    console.error('Create QR error:', err);
    res.status(500).json({ message: 'Failed to create QR payment', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/webhook
// Updated to work with the new schema (Order ID is in payments table)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_default_secret';
  const signature = req.headers['x-razorpay-signature'];

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(req.body));
    const digest = hmac.digest('hex');

    if (signature !== digest) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const orderId = req.body.payload.payment.entity.order_id;
      const paymentId = req.body.payload.payment.entity.id;

      // 1. Find the bill_id associated with this order_id from the payments table
      const [payments] = await db.query(
        'SELECT bill_id FROM payments WHERE order_id = ?',
        [orderId]
      );

      if (payments.length > 0) {
        const billId = payments[0].bill_id;

        // 2. Update bill to paid online
        await db.query(
          `UPDATE bills SET payment_status = 'paid', payment_mode = 'online'
           WHERE bill_id = ?`,
          [billId]
        );
        
        // 3. Update the payments tracking table
        await db.query(
          `UPDATE payments SET status = 'paid', payment_id = ? WHERE order_id = ?`,
          [paymentId, orderId]
        );

        console.log(`✅ Webhook confirmed payment for Bill: ${billId}`);
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal Error');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/verify-payment (Legacy Support)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !billId) {
      return res.status(400).json({ message: 'Missing required payment verification fields' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await db.query(
        `UPDATE payments SET status = 'failed', payment_id = ? WHERE order_id = ?`,
        [razorpay_payment_id, razorpay_order_id]
      );
      return res.status(400).json({ message: 'Signature mismatch' });
    }

    await db.query(
      `UPDATE bills SET payment_status = 'paid', payment_mode = 'online' WHERE bill_id = ?`,
      [billId]
    );

    await db.query(
      `UPDATE payments SET status = 'paid', payment_id = ? WHERE order_id = ?`,
      [razorpay_payment_id, razorpay_order_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).send('Error');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/mark-as-cash
// Marks a bill as paid via Cash
// ─────────────────────────────────────────────────────────────────────────────
router.post('/mark-as-cash', authMiddleware, async (req, res) => {
  try {
    const { billId } = req.body;

    if (!billId) {
      return res.status(400).json({ message: 'billId is required' });
    }

    await db.query(
      `UPDATE bills SET payment_status = 'paid', payment_mode = 'cash' WHERE bill_id = ? AND user_id = ?`,
      [billId, req.user.userId]
    );

    console.log(`✅ Bill ${billId} marked as paid via Cash`);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark as cash error:', err);
    res.status(500).json({ message: 'Failed to update payment status' });
  }
});

module.exports = router;
