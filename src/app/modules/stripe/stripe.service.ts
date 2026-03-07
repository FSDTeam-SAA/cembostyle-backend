import Stripe from 'stripe';
import config from '../../config';

const stripe = new Stripe(config.stripe.secret_key as string, {
  apiVersion: '2026-02-25.clover', // Use your current API version
});

const createCheckoutSession = async (planType: 'monthly' | 'yearly', email: string) => {
  const priceId = planType === 'monthly' ? config.stripe.price_monthly : config.stripe.price_yearly;

  if (!priceId) {
    throw new Error('Invalid plan selection');
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId, // e.g., 'price_H5ggY...M9' (Monthly/Yearly ID from Stripe dashboard)
        quantity: 1,
      },
    ],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: 3,
    },
    customer_email: email, // Used to associate the session with the user
    metadata: { planType: planType },
    success_url: `${config.urls.frontend}/success`,
    cancel_url: `${config.urls.frontend}/cancel`,
  });

  return session;
};

export const StripeService = {
  createCheckoutSession,
};
