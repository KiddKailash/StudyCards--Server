// routes/checkoutRoutes.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const authMiddleware = require('../middleware/authMiddleware');
const { ObjectId } = require('mongodb');
const { getDB } = require('../utils/db');

/**
 * @route   POST /api/checkout/create-checkout-session
 * @desc    Create a Stripe Checkout session
 * @access  Private
 */
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  const { accountType } = req.body; // e.g., 'free', 'paid'

  if (!accountType) {
    return res.status(400).json({ error: 'Account type is required.' });
  }

  // Define price IDs for different account types
  const priceIds = {
    paid: 'price_1MaAMfHF9XSKpzYgd1j3UGgFEPaYvit41dhGsqLJchCTVJxl0weH5wYkjOR7NihTSu3IsQrZBGWH5l47NeJhUePW005BW3bXsr', // Replace with your actual Price ID
    // Add more tiers if necessary
  };

  const selectedPriceId = priceIds[accountType];

  if (!selectedPriceId) {
    return res.status(400).json({ error: 'Invalid account type.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Use 'payment' for one-time payments
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      automatic_tax: { enabled: true },
      metadata: {
        userId: req.user.id, // Associate session with user
        accountType: accountType,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

module.exports = router;
