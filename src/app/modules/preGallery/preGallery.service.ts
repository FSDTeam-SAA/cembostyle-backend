import { IGalleryImage } from './preGallery.interface';
import { PreGallery } from './preGallery.model';

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

const updateGalleryItem = async (
  id: string,
  payload: Partial<IGalleryImage>,
) => {
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
  updateGalleryItem,
  deleteGalleryItem,
};
