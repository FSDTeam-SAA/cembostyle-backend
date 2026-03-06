import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AiStencilService } from './aiStencil.service';
import { TStencilErrorCode } from './aiStencil.interface';

const getFailureStatusCode = (errorCode?: TStencilErrorCode) => {
  switch (errorCode) {
    case 'AI_TIMEOUT':
      return 504;
    case 'AI_QUOTA_EXCEEDED':
      return 429;
    case 'AI_MODEL_UNAVAILABLE':
      return 503;
    case 'AI_BAD_RESPONSE':
    case 'AI_PROCESSING_FAILED':
    default:
      return 502;
  }
};

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

  const statusCode = result.status === 'FAILED' ? getFailureStatusCode(result.errorCode) : 201;
  const message =
    result.status === 'FAILED'
      ? result.errorMessage || 'Stencil generation failed'
      : 'Stencil generated successfully';

  sendResponse(res, {
    statusCode,
    success: result.status !== 'FAILED',
    message,
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
