import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PaymentServices } from './payment.service';
import httpStatus from 'http-status';

const getTotalPaymentAmount = catchAsync(async (req, res) => {
  const totalAmount = await PaymentServices.getTotalPaymentAmount();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Total payment amount retrieved successfully',
    data: {
      totalAmount,
    },
  });
});

const getPaymentsStats = catchAsync(async (req, res) => {
  const { period } = req.query as { period: 'month' | 'year' };
  const stats = await PaymentServices.getPaymentsGroupedByPeriod(period || 'month');

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment statistics retrieved successfully',
    data: stats,
  });
});

export const PaymentControllers = {
  getTotalPaymentAmount,
  getPaymentsStats,
};
