import { IGalleryImage } from './preGallery.interface';
import { PreGallery } from './preGallery.model';
import AppError from '../../errors/AppError';

const createGalleryItem = async (payload: IGalleryImage) => {
  const result = await PreGallery.create(payload);
  return result;
};

const getAllGalleryItems = async () => {
  const result = await PreGallery.find();
  return result;
};

const getGalleryItemsByCategory = async (category: string) => {
  const result = await PreGallery.find({ category });
  return result;
};

const getGalleryItemById = async (id: string) => {
  const result = await PreGallery.findById(id);
  if (!result) {
    throw new AppError(404, 'Gallery item not found');
  }

  return result;
};

const updateGalleryItem = async (id: string, payload: Partial<IGalleryImage>) => {
  const result = await PreGallery.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

const deleteGalleryItem = async (id: string) => {
  const result = await PreGallery.findByIdAndDelete(id);
  return result;
};

export const PreGalleryService = {
  createGalleryItem,
  getAllGalleryItems,
  getGalleryItemsByCategory,
  getGalleryItemById,
  updateGalleryItem,
  deleteGalleryItem,
};
