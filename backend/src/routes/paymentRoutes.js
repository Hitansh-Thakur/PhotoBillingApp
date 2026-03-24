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

    // Save order record to DB
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
// POST /api/payment/verify-payment
// Verifies HMAC signature from Razorpay and marks bill as paid
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !billId) {
      return res.status(400).json({ message: 'Missing required payment verification fields' });
    }

    // Verify signature using HMAC-SHA256
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn(`⚠️  Payment signature mismatch for bill ${billId}`);

      // Mark payment record as failed
      await db.query(
        `UPDATE payments SET status = 'failed', payment_id = ? WHERE order_id = ?`,
        [razorpay_payment_id, razorpay_order_id]
      );

      return res.status(400).json({ message: 'Payment verification failed: Invalid signature' });
    }

    // Signature valid — mark bill as paid and online
    await db.query(
      `UPDATE bills SET payment_status = 'paid', payment_mode = 'online' WHERE bill_id = ? AND user_id = ?`,
      [billId, req.user.userId]
    );

    // Update payment record
    await db.query(
      `UPDATE payments SET status = 'paid', payment_id = ? WHERE order_id = ?`,
      [razorpay_payment_id, razorpay_order_id]
    );

    console.log(`✅ Payment verified for bill ${billId}, payment ID: ${razorpay_payment_id}`);

    res.json({ success: true, message: 'Payment verified and bill marked as paid online' });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ message: 'Internal server error during payment verification' });
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payment/checkout/:orderId
// Serves a self-contained Razorpay web checkout HTML page.
// This is the Expo Go-compatible approach (no native SDK needed).
// After payment, Razorpay calls the callback URL to return payment details.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/checkout/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, billId, name, description, callbackUrl } = req.query;

    if (!orderId || !amount || !billId) {
      return res.status(400).send('<h2>Invalid checkout parameters</h2>');
    }

    const keyId = process.env.RAZORPAY_KEY_ID;

    // Serve a minimal Razorpay checkout page that auto-opens the payment modal
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment - Photo Billing</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f1a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #fff;
    }
    .card {
      background: #1a1a2e;
      border: 1px solid rgba(100,100,255,0.2);
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      max-width: 360px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .logo { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin-bottom: 8px; color: #e0e0ff; }
    .amount {
      font-size: 36px;
      font-weight: 700;
      color: #7c6aff;
      margin: 16px 0;
    }
    .desc { font-size: 14px; color: #888; margin-bottom: 28px; }
    .btn {
      background: linear-gradient(135deg, #7c6aff, #5c4fff);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 14px 32px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .secure { font-size: 12px; color: #555; margin-top: 16px; }
    #status { margin-top: 20px; font-size: 15px; }
    .success { color: #4caf50; font-weight: 600; }
    .error { color: #f44336; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💳</div>
    <h1>${name || 'Photo Billing'}</h1>
    <div class="amount">₹${(parseInt(amount) / 100).toFixed(2)}</div>
    <p class="desc">${description || 'Complete your payment securely'}</p>
    <button class="btn" id="payBtn" onclick="openCheckout()">Pay Now</button>
    <p class="secure">🔒 Secured by Razorpay</p>
    <div id="status"></div>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function openCheckout() {
      document.getElementById('payBtn').disabled = true;
      document.getElementById('payBtn').textContent = 'Opening...';

      var options = {
        key: "${keyId}",
        amount: "${amount}",
        currency: "INR",
        name: "${name || 'Photo Billing'}",
        description: "${description || 'Bill Payment'}",
        order_id: "${orderId}",
        handler: function(response) {
          // Payment success - redirect back to app with payment details
          var successUrl = "${callbackUrl || ''}"
            + "?razorpay_order_id=" + response.razorpay_order_id
            + "&razorpay_payment_id=" + response.razorpay_payment_id
            + "&razorpay_signature=" + response.razorpay_signature
            + "&billId=${billId}"
            + "&status=success";

          document.getElementById('status').innerHTML = '<p class="success">✅ Payment Successful! Returning to app...</p>' +
            '<p style="margin-top:20px; font-size:14px; color:#888;">If you are not redirected, <a href="' + successUrl + '" style="color:#7c6aff; text-decoration:none; font-weight:600;">click here</a></p>';
          document.getElementById('payBtn').style.display = 'none';

          // Use window.location for deep link redirect
          setTimeout(function() {
            window.location.href = successUrl;
          }, 500);
        },
        modal: {
          ondismiss: function() {
            document.getElementById('payBtn').disabled = false;
            document.getElementById('payBtn').textContent = 'Pay Now';
            document.getElementById('status').innerHTML = '<p class="error">Payment cancelled. Try again.</p>';
          }
        },
        theme: { color: "#7c6aff" }
      };

      var rzp = new Razorpay(options);

      rzp.on('payment.failed', function(response) {
        var failUrl = "${callbackUrl || ''}"
          + "?status=failed"
          + "&error=" + encodeURIComponent(response.error.description)
          + "&billId=${billId}";
        document.getElementById('status').innerHTML = '<p class="error">❌ Payment Failed. Returning to app...</p>';
        setTimeout(function() { window.location.href = failUrl; }, 1000);
      });

      rzp.open();
    }

    // Auto-open on load for smoother UX
    window.onload = function() { setTimeout(openCheckout, 500); };
  </script>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error('Checkout page error:', err);
    res.status(500).send('<h2>Something went wrong. Please go back to the app.</h2>');
  }
});

module.exports = router;
