import { IAiStencil } from './aiStencil.interface';
import { AiStencil } from './aiStencil.model';

const createStencil = async (payload: IAiStencil) => {
  const result = await AiStencil.create(payload);
  return result;
};

const getMyAllStencil = async (userId: string) => {
  const data = await AiStencil.find({ user: userId });
  const count = await AiStencil.countDocuments({ user: userId });
  return { data, count };
};

const updateStencil = async (id: string, userId: string, payload: Partial<IAiStencil>) => {
  const result = await AiStencil.findOneAndUpdate({ _id: id, user: userId }, payload, {
    new: true,
  });
  return result;
};

const deleteStencil = async (id: string, userId: string) => {
  const result = await AiStencil.findOneAndDelete({ _id: id, user: userId });
  return result;
};

export const AiStencilService = {
  createStencil,
  getMyAllStencil,
  updateStencil,
  deleteStencil,
};
