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

// const getAllUsers = async (query: Record<string, unknown>) => {
//   const userSearchableFields = ['name', 'email', 'role'];

//   const userQuery = new QueryBuilder(User.find({ role: 'USER' }), query)
//     .search(userSearchableFields)
//     .filter()
//     .sort()
//     .paginate()
//     .fields();

//   const result = await userQuery.modelQuery;
//   const meta = await userQuery.countTotal();

//   return {
//     meta,
//     result,
//   };
// };

const getAllUsers = async (query: Record<string, unknown>) => {
  const pipeline = [
    { $match: { role: 'USER' } },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'user',
        as: 'payments',
      },
    },
    {
      $addFields: {
        totalPayment: { $sum: '$payments.amount' },
      },
    },
    { $project: { payments: 0 } },
  ];

  const result = await User.aggregate(pipeline);
  return { result };
};

const getPremiumUsers = async (query: Record<string, unknown>) => {
  const userSearchableFields = ['name', 'email', 'role'];

  const userQuery = new QueryBuilder(User.find({ role: 'USER', isPremium: true }), query)
    .search(userSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getFreeUsers = async (query: Record<string, unknown>) => {
  const userSearchableFields = ['name', 'email', 'role'];

  const userQuery = new QueryBuilder(User.find({ role: 'USER', isPremium: false }), query)
    .search(userSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();

  return {
    meta,
    result,
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
  getPremiumUsers,
  getFreeUsers,
  blockUser,
  updatePremiumStatus,
};
