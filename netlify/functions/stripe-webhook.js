const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.metadata.supabase_user_id;
        const customerId = session.customer;

        await supabase
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            subscription_status: 'active',
            subscription_id: session.subscription,
          })
          .eq('id', userId);

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        const customerId = subscription.customer;
        const status = subscription.status === 'active' ? 'active' : 'inactive';

        await supabase
          .from('profiles')
          .update({ subscription_status: status })
          .eq('stripe_customer_id', customerId);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const customerId = subscription.customer;

        await supabase
          .from('profiles')
          .update({
            subscription_status: 'inactive',
            subscription_id: null,
          })
          .eq('stripe_customer_id', customerId);

        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    return { statusCode: 500, body: 'Webhook processing error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
