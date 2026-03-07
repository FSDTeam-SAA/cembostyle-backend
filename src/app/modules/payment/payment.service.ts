import { Payment } from './payment.model';

const getTotalPaymentAmount = async () => {
  const result = await Payment.aggregate([
    {
      $group: {
        _id: null, // Group all documents together
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);

  return result.length > 0 ? result[0].totalAmount : 0;
};

const getPaymentsGroupedByPeriod = async (period: 'month' | 'year') => {
  const format = period === 'month' ? '%Y-%m' : '%Y';

  return await Payment.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: format, date: '$createdAt' } },
        totalAmount: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

export const PaymentServices = {
  getTotalPaymentAmount,
  getPaymentsGroupedByPeriod,
};
