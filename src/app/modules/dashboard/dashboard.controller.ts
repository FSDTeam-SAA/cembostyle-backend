import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DashboardServices } from './dashboard.service';
import httpStatus from 'http-status';

const getDashboardStats = catchAsync(async (req, res) => {
  const stats = await DashboardServices.getDashboardStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard statistics retrieved successfully',
    data: stats,
  });
});

export const DashboardControllers = { getDashboardStats };
