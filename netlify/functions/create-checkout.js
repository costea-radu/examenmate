const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, email } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      metadata: { supabase_user_id: userId },
      subscription_data: {
        metadata: { supabase_user_id: userId }          // ← IMPORTANT pentru subscription events
      },
      line_items: [
        {
          price_data: {
            currency: 'ron',
            product_data: {
              name: 'ExamenMate Premium',
              description: 'Abonament lunar – acces complet la toate materialele',
            },
            unit_amount: 5000, // 50.00 RON in bani (cents)
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.URL || 'https://mate-online.netlify.app'}/profil?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://mate-online.netlify.app'}/preturi`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Checkout error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
