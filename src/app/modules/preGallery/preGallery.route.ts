import express from 'express';
import { PreGalleryController } from './preGallery.controller';
import { fileUploader } from '../../utils/fileUploader';

const router = express.Router();

router.post(
  '/create-gallery-item',
  fileUploader.upload.single('file'),
  PreGalleryController.createGalleryItem,
);
router.get('/get-all-gallery-items', PreGalleryController.getAllGalleryItems);
router.get('/:category', PreGalleryController.getGalleryItemsByCategory);
router.patch('/:id', PreGalleryController.updateGalleryItem);
router.delete('/:id', PreGalleryController.deleteGalleryItem);

export const PreGalleryRoutes = router;
