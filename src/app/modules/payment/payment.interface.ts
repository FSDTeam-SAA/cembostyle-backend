import { Types } from 'mongoose';

export interface IPayment {
  user: Types.ObjectId;
  amount: number;
  currency: string;
  stripeTransactionId: string;
  planType: 'monthly' | 'yearly';
  paymentStatus: 'succeeded' | 'pending' | 'failed';
  invoiceId?: string; // Optional: map to Stripe invoice
}
