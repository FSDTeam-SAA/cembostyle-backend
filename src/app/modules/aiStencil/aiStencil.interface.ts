import { Types } from 'mongoose';

export type TStencilStyleId =
  | 'outline'
  | 'realism'
  | 'printhatch';

export type TColorThemeId =
  | 'tattoo_black_grey'
  | 'stencil_violet'
  | 'stencil_cobalt_blue'
  | 'red_black_contrast'
  | 'deep_blue_ink'
  | 'sepia_draft'
  | 'super_contrast';

export type TThemeRenderMode = 'local_tint' | 'gemini';

export type TStencilErrorCode =
  | 'AI_TIMEOUT'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_BAD_RESPONSE'
  | 'AI_PROCESSING_FAILED';

export interface IAiImageRef {
  url: string;
  publicId: string;
}

export interface IAiStencil {
  user: Types.ObjectId | string;
  originalImage?: IAiImageRef;
  stencilImage?: IAiImageRef;
  baseStencilImage?: IAiImageRef;
  style: string;
  styleId?: TStencilStyleId;
  colorTheme?: string;
  colorThemeId?: TColorThemeId;
  themeRenderMode?: TThemeRenderMode;
  sourceFingerprint?: string;
  generationSignature?: string;
  detailLevel?: number;
  brightness?: number;
  contrast?: number;
  isSaved?: boolean;
  status?: 'COMPLETED' | 'FAILED';
  errorCode?: TStencilErrorCode;
  errorMessage?: string;
}
