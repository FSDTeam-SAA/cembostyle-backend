import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { fileUploader } from '../../utils/fileUploader';
import { AiStencilService } from './aiStencil.service';

const createStencil = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new Error('Image file is required');
  }
  const uploadedImage = await fileUploader.uploadToCloudinary(req.file);

  const stencilData = {
    user: req.user.id,
    originalImage: {
      url: uploadedImage.url,
      publicId: uploadedImage.public_id,
    },
    ...req.body,
  };

  const result = await AiStencilService.createStencil(stencilData);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Stencil job created successfully',
    data: result,
  });
});

const getMyAllStencil = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await AiStencilService.getMyAllStencil(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Stencils retrieved successfully',
    data: result.data,
    meta: { total: result.count },
  });
});

const updateStencil = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  const result = await AiStencilService.updateStencil(id as string, userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Stencil updated successfully',
    data: result,
  });
});

const deleteStencil = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  const result = await AiStencilService.deleteStencil(id as string, userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Stencil deleted successfully',
    data: result,
  });
});

export const AiStencilController = {
  createStencil,
  getMyAllStencil,
  updateStencil,
  deleteStencil,
};
