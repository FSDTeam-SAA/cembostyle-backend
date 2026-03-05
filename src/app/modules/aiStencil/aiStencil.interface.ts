import { Types } from 'mongoose';

export type TStencilStyle = 'Outline' | 'Realism Map' | 'Detail Guide' | 'Halftone Guide';

// export type TColorTheme =
//   | 'Tattoo Black & Grey'
//   | 'Stencil Violet'
//   | 'Stencil Cobalt Blue'
//   | 'Red & Black Contrast'
//   | 'Deep Blue Ink'
//   | 'Sepia Draft'
//   | 'Super Contrast';

// export type TStyleLevel = 'Simple' | 'Basic' | 'Sketch';

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
  // adjustments?: {
  //   brightness?: number;
  //   contrast?: number;
  // };
  status?: 'COMPLETED' | 'FAILED';
  // availableThemes?: TColorTheme[];
  // styleLevel?: TStyleLevel[];
}
