import { Types } from 'mongoose';

export type TStencilStyle = 'Outline' | 'Realism Map' | 'Detail Guide' | 'Halftone Guide';
export type TStencilErrorCode =
  | 'AI_TIMEOUT'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_BAD_RESPONSE'
  | 'AI_PROCESSING_FAILED';
export interface IAiStencil {
  user: Types.ObjectId;
  originalImage?: {
    url: string;
    publicId: string;
  };
  stencilImage?: {
    url: string;
    publicId: string;
  };
  style: TStencilStyle;
  colorTheme?: string;
  detailLevel?: number;
  brightness?: number;
  contrast?: number;
  isSaved?: boolean;
  status?: 'COMPLETED' | 'FAILED';
  errorCode?: TStencilErrorCode;
  errorMessage?: string;
}
