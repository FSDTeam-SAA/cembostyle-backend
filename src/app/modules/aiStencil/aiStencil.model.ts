import { Schema, model } from 'mongoose';
import { IAiStencil } from './aiStencil.interface';

const aiStencilSchema = new Schema<IAiStencil>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalImage: {
      url: { type: String },
      publicId: { type: String },
    },
    stencilImage: {
      url: { type: String },
      publicId: { type: String },
    },
    style: { type: String, required: true },
    // adjustments: {
    //   brightness: { type: Number },
    //   contrast: { type: Number },
    // },
    status: { type: String, enum: ['COMPLETED', 'FAILED'] },
    // availableThemes: { type: [String] },
    // styleLevel: { type: [String] },
  },
  { timestamps: true },
);

export const AiStencil = model<IAiStencil>('AiStencil', aiStencilSchema);
