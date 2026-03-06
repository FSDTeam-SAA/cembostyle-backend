import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AiStencilService } from './aiStencil.service';

const createStencil = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }

  // Pass user ID from auth middleware and style from body
  const result = await AiStencilService.createStencil(
    {
      user: req.user?.id,
      style: req.body.style || 'Outline',
      ...req.body,
    },
    req.file,
  );

  // If the service caught an error and set status to FAILED
  const statusCode = result.status === 'FAILED' ? 400 : 201;

  sendResponse(res, {
    statusCode,
    success: result.status !== 'FAILED',
    message:
      result.status === 'FAILED' ? 'Stencil generation failed' : 'Stencil generated successfully',
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
