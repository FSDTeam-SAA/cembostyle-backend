import { Schema, model } from 'mongoose';
import { IGalleryImage } from './preGallery.interface';

const preGallerySchema = new Schema<IGalleryImage>(
  {
    category: { type: String, required: true },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
  },
  { timestamps: true },
);

export const PreGallery = model<IGalleryImage>('PreGallery', preGallerySchema);
