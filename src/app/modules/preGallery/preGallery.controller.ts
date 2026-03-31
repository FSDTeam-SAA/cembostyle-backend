import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { fileUploader } from '../../utils/fileUploader';
import { PreGalleryService } from './preGallery.service';
import { AiStencilService } from '../aiStencil/aiStencil.service';

const createGalleryItem = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new Error('Image file is required');
  }
  const uploadedImage = await fileUploader.uploadToCloudinary(req.file);

  req.body.image = {
    url: uploadedImage.url,
    publicId: uploadedImage.public_id,
  };

  const result = await PreGalleryService.createGalleryItem(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Gallery item created successfully',
    data: result,
  });
});

const getAllGalleryItems = catchAsync(async (req: Request, res: Response) => {
  const result = await PreGalleryService.getAllGalleryItems();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Gallery items retrieved successfully',
    data: result,
  });
});

const getGalleryItemsByCategory = catchAsync(
  async (req: Request, res: Response) => {
    const { category } = req.params;
    const result = await PreGalleryService.getGalleryItemsByCategory(
      category as string,
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Gallery items retrieved by category successfully',
      data: result,
    });
  },
);

const generateGalleryPreview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { colorTheme, colorThemeId, detailLevel, brightness, contrast } = req.body;
  const galleryItem = await PreGalleryService.getGalleryItemById(id as string);

  const result = await AiStencilService.createGalleryPreview({
    originalImage: galleryItem.image,
    style: galleryItem.category,
    styleId: req.body.styleId,
    colorTheme,
    colorThemeId,
    detailLevel: Number(detailLevel ?? 1),
    brightness: Number(brightness ?? 0.8),
    contrast: Number(contrast ?? 0.6),
  });

  sendResponse(res, {
    statusCode: result.status === 'FAILED' ? 502 : 200,
    success: result.status !== 'FAILED',
    message:
      result.status === 'FAILED'
        ? result.errorMessage || 'Gallery preview generation failed'
        : 'Gallery preview generated successfully',
    data: result,
  });
});

const updateGalleryItem = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await PreGalleryService.updateGalleryItem(
    id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Gallery item updated successfully',
    data: result,
  });
});

const deleteGalleryItem = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await PreGalleryService.deleteGalleryItem(id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Gallery item deleted successfully',
    data: result,
  });
});

export const PreGalleryController = {
  createGalleryItem,
  getAllGalleryItems,
  getGalleryItemsByCategory,
  generateGalleryPreview,
  updateGalleryItem,
  deleteGalleryItem,
};
