// export type TColorTheme =
//   | 'Tattoo Black & Grey'
//   | 'Stencil Violet'
//   | 'Stencil Cobalt Blue'
//   | 'Red & Black Contrast'
//   | 'Deep Blue Ink'
//   | 'Sepia Draft'
//   | 'Super Contrast';

// export type TStyleLevel = 'Simple' | 'Basic' | 'Sketch';

export type TCategory = 'Outline' | 'Realism Map' | 'Detail Guide' | 'Halftone Guide';

export interface IGalleryImage {
  category: TCategory;
  image: {
    url: string;
    publicId: string;
  };
  // availableThemes?: TColorTheme[];
  // styleLevel?: TStyleLevel[];
}
