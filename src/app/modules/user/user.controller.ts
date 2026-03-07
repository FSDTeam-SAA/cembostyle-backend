import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.service';
import httpStatus from 'http-status';

const getProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;

  const result = await UserServices.getProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User profile retrieved successfully',
    data: result,
  });
});

const updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const userData = req.body.data ? JSON.parse(req.body.data) : { ...req.body };

  const result = await UserServices.updateProfile(userId, userData, req.file);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile updated successfully',
    data: result,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const result = await UserServices.getAllUsers(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getSingleUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await UserServices.getSingleUser(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User retrieved successfully',
    data: result,
  });
});

const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  await UserServices.deleteUser(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: null,
  });
});

const blockUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { isBlocked } = req.body;

  const result = await UserServices.blockUser(userId as string, isBlocked);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
    data: result,
  });
});

const updatePremiumStatus = catchAsync(async (req: Request, res: Response) => {
  const { email, isPremium } = req.body;

  const result = await UserServices.updatePremiumStatus(email, isPremium);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User premium status updated successfully',
    data: result,
  });
});

export const UserControllers = {
  getProfile,
  updateProfile,
  getAllUsers,
  getSingleUser,
  deleteUser,
  blockUser,
  updatePremiumStatus,
};
