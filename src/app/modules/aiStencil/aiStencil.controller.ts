import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AiStencilService } from './aiStencil.service';
import { IAiImageRef, TStencilErrorCode } from './aiStencil.interface';

const parseMaybeJson = <T>(value: unknown): T | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch (_) {
    return undefined;
  }
};

const parseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
  const originalImage = parseMaybeJson<IAiImageRef>(req.body.originalImage);

  if (!req.file && !originalImage) {
    return res
      .status(400)
      .json({ success: false, message: 'Image file or original image reference is required' });
  }

  const result = await AiStencilService.createStencil(
    {
      user: req.user?.id,
      style: req.body.style || req.body.styleId || 'outline',
      styleId: req.body.styleId,
      colorTheme: req.body.colorTheme,
      colorThemeId: req.body.colorThemeId,
      ...(originalImage ? { originalImage } : {}),
      detailLevel: parseNumber(req.body.detailLevel, 1),
      brightness: parseNumber(req.body.brightness, 0.8),
      contrast: parseNumber(req.body.contrast, 0.6),
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
