export type TCategory =
  | 'Outline'
  | 'Realism'
  | 'PrintHatch'
  | 'Realism Map'
  | 'Detail Guide'
  | 'Halftone Guide';

export interface IGalleryImage {
  category: TCategory;
  image: {
    url: string;
    publicId: string;
  };
}
