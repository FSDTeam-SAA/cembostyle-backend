import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { fileDeleter } from '../../utils/deleteFile';
import { fileUploader } from '../../utils/fileUploader';
import { IUser } from './user.interface';
import { User } from './user.model';
import httpStatus from 'http-status';

const getProfile = async (userId: string) => {
  const result = await User.findById(userId);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User profile not found');
  }
  return result;
};

const updateProfile = async (userId: string, payload: Partial<IUser>, file?: any) => {
  const isUserExist = await User.findById(userId);
  if (!isUserExist) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (file) {
    const uploadResult = await fileUploader.uploadToCloudinary(file);

    payload.profileImage = {
      url: uploadResult.url,
      publicId: uploadResult.public_id,
    };
  }

  const result = await User.findByIdAndUpdate(userId, payload, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (file && isUserExist.profileImage?.publicId)
    await fileDeleter.deleteFromCloudinary(isUserExist.profileImage.publicId);

  return result;
};

const getAllUsers = async (query: Record<string, unknown>) => {
  const { searchTerm, page = 1, limit = 10, sortBy, sortOrder } = query;

  const matchStage: any = { role: 'USER' };
  if (searchTerm) {
    matchStage.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const pipeline: any[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'user',
        as: 'payments',
      },
    },
    { $addFields: { totalPayment: { $sum: '$payments.amount' } } },
    { $project: { payments: 0 } },
    {
      $facet: {
        meta: [{ $count: 'total' }],
        result: [
          { $sort: { [(sortBy as string) || 'createdAt']: sortOrder === 'desc' ? -1 : 1 } },
          { $skip: (Number(page) - 1) * Number(limit) },
          { $limit: Number(limit) },
        ],
      },
    },
  ];

  const data = await User.aggregate(pipeline);
  return {
    meta: { total: data[0].meta[0]?.total || 0 },
    result: data[0].result,
  };
};

const getSingleUser = async (id: string) => {
  const result = await User.findById(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result;
};

const deleteUser = async (id: string) => {
  const result = await User.findByIdAndDelete(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result;
};

const blockUser = async (userId: string, isBlocked: boolean) => {
  const updatedUser = await User.findByIdAndUpdate(userId, { isBlocked }, { new: true });
  return updatedUser;
};

const updatePremiumStatus = async (email: string, isPremium: boolean) => {
  const updatedUser = await User.findOneAndUpdate({ email }, { isPremium }, { new: true });

  if (!updatedUser) {
    throw new Error('User not found');
  }

  return updatedUser;
};

export const UserServices = {
  getProfile,
  updateProfile,
  getAllUsers,
  getSingleUser,
  deleteUser,
  blockUser,
  updatePremiumStatus,
};
