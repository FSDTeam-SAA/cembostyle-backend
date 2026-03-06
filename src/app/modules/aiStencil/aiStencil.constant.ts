import { TStencilStyle } from './aiStencil.interface';

export const STENCIL_PROMPTS: Record<TStencilStyle, string> = {
  Outline:
    'Transform this image into a clean, high-contrast black and white stencil. Use bold, clear black contour lines on a solid white background. Remove all colors, shading, and gradients.',

  'Realism Map':
    'Generate a photorealistic grayscale depth map of the subject. Use pure white for the closest parts and deep black for the furthest parts. Ensure smooth gradients to represent 3D volume and anatomical structure.',

  'Detail Guide':
    'Enhance this image into a high-detail texture guide. Sharpen all micro-textures, fur grain, and skin pores. Use extreme contrast to highlight the intricate details and textures of the subject.',

  'Halftone Guide':
    'Convert this image into a stylized halftone dot pattern. Use varying sizes of black dots on a white background to represent highlights and shadows, creating a vintage comic or screen-print aesthetic.',
};
