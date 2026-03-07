import { Schema, model } from 'mongoose';
import { IPayment } from './payment.interface';

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    stripeTransactionId: { type: String, required: true, unique: true },
    planType: { type: String, enum: ['monthly', 'yearly'], required: true },
    paymentStatus: {
      type: String,
      enum: ['succeeded', 'pending', 'failed'],
      default: 'pending',
    },
    invoiceId: { type: String },
  },
  {
    timestamps: true,
  },
);

export const Payment = model<IPayment>('Payment', paymentSchema);
