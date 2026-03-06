import { Types } from 'mongoose';

export type TStencilStyle = 'Outline' | 'Realism Map' | 'Detail Guide' | 'Halftone Guide';
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
  status?: 'COMPLETED' | 'FAILED';
}
