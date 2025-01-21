const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const authMiddleware = require('../middleware/authMiddleware');
const { getDB } = require('../database/db');
const { ObjectId } = require('mongodb');

/**
 * @route   POST /api/checkout/create-checkout-session
 * @desc    Create a Stripe Checkout session for upgrading to paid subscription
 * @access  Private
 */
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  const { accountType } = req.body;

  if (!accountType) {
    return res.status(400).json({ error: 'Account type is required.' });
  }

  const priceIds = {
    paid: process.env.STRIPE_PRICE_ID_PAID, // Example: you have this set in your .env
  };

  const selectedPriceId = priceIds[accountType];

  if (!selectedPriceId) {
    return res.status(400).json({ error: 'Invalid account type.' });
  }

  // --- Optional debugging code: can remove in production ---
  try {
    const products = await stripe.products.list({ limit: 100 });
    console.log('Existing products:', products.data);

    const prices = await stripe.prices.list({ limit: 100 });
    console.log('Existing prices:', prices.data);

    console.log('Selected Price ID:', selectedPriceId);
    const priceExists = prices.data.some((price) => price.id === selectedPriceId);
    console.log('Does the selected Price ID exist?', priceExists);

    if (!priceExists) {
      return res.status(400).json({ error: 'Selected price ID does not exist.' });
    }
  } catch (error) {
    console.error('Error fetching products or prices:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch products or prices from Stripe.' });
  }
  // --- End of optional debugging code ---

  try {
    // Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}`,
      automatic_tax: { enabled: true },
      customer_email: req.user.email, // include the user's email
      metadata: {
        userId: req.user.id,
        accountType: accountType,
      },
    });

    // IMPORTANT: return session.url as well so the front-end can open it in a new tab
    res.json({
      sessionId: session.id,
      checkoutUrl: session.url, // This is Stripe's hosted Checkout link
    });
  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

/**
 * @route   POST /api/checkout/cancel-subscription
 * @desc    Cancel the user's subscription immediately
 * @access  Private
 */
router.post('/cancel-subscription', authMiddleware, async (req, res) => {
  try {
    const subscriptionId = req.user.subscriptionId;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'No subscription found for this user.' });
    }

    // Cancel the subscription using the code snippet from Stripe documentation
    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    // Update the user's record to reflect the canceled subscription
    const db = getDB();
    const usersCollection = db.collection('users');
    await usersCollection.updateOne(
      { _id: new ObjectId(req.user.id) },
      {
        $set: {
          accountType: 'free',
        },
      }
    );

    res.status(200).json({
      message: 'Subscription canceled successfully.',
      subscription,
    });
  } catch (err) {
    console.error('Error canceling subscription:', err);
    res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
});

module.exports = router;
