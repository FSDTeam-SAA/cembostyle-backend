export type TCategory = 'Outline' | 'Realism Map' | 'Detail Guide' | 'Halftone Guide';

export interface IGalleryImage {
  category: TCategory;
  image: {
    url: string;
    publicId: string;
  };
}
