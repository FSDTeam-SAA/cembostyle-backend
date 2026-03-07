import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { StripeService } from './stripe.service';
import sendResponse from '../../utils/sendResponse';
import Stripe from 'stripe';
import config from '../../config';
import { User } from '../user/user.model';
import { Payment } from '../payment/payment.model';

const stripe = new Stripe(config.stripe.secret_key as string);

const createPaymentSession = catchAsync(async (req: Request, res: Response) => {
  const { planType } = req.body;
  const { email } = req.user;

  const session = await StripeService.createCheckoutSession(planType, email);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment session created successfully',
    data: { url: session.url },
  });
});

const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    // Verify the event using your Webhook Secret
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhook_secret as string);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;

    // Log the data to your terminal to inspect it!
    // console.log('--- SESSION RECEIVED ---');
    // console.log('Customer Email from Stripe:', session.customer_email);
    // console.log('Customer Details from Stripe:', session.customer_details?.email);

    const email = session.customer_email || session.customer_details?.email;

    if (email) {
      const user = await User.findOneAndUpdate(
        { email },
        {
          isPremium: true,
          subscriptionId: session.subscription as string,
          subscriptionStatus: 'active',
        },
        { new: true },
      );

      if (user) {
        // Create the Payment record
        await Payment.create({
          user: user._id,
          amount: session.amount_total! / 100, // Convert cents to currency units
          currency: session.currency as string,
          stripeTransactionId: session.id,
          planType: session.metadata?.planType || 'monthly', // Ensure you pass planType in metadata during session creation
          paymentStatus: 'succeeded',
          invoiceId: session.invoice as string,
        });
      }
    }
  }
  res.json({ received: true });
};

export const StripeController = {
  createPaymentSession,
  handleWebhook,
};
