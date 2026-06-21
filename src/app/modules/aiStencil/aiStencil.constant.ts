import { TColorThemeId, TStencilStyleId, TThemeRenderMode } from './aiStencil.interface';

type StyleSpec = {
  id: TStencilStyleId;
  label: string;
  subtitle: string;
  prompt: string;
  expectedOutcome: string;
  expectedImageCount: number;
};

type ThemeSpec = {
  id: TColorThemeId;
  label: string;
  renderMode: TThemeRenderMode;
  accentHex: string;
  prompt?: string;
  expectedOutcome: string;
};

export const STENCIL_PROMPT_VERSION = 'bheppo-pdf-v2';

export const STENCIL_STYLE_SPECS: Record<TStencilStyleId, StyleSpec> = {
  outline: {
    id: 'outline',
    label: 'Outline',
    subtitle: 'Clean tattoo transfer outline',
    prompt: `Convert the uploaded image into a clean tattoo-style outline stencil.
Generate ONLY the external and essential internal contour lines of the subject.

Rules:
- pure black outlines on clean white background
- no shading
- no gradients
- no grey tones
- no textures
- no shadows
- no solid black fill areas
- no sketch effect
- no artistic reinterpretation
- preserve original proportions and structure exactly
- keep outlines smooth, sharp, and readable
- simplify unnecessary micro-details and noise
- for text: convert letters into clean vector-like outline contours only
- for images: keep only major contour lines and important internal separations
- output must look like a professional tattoo transfer stencil
- centered composition
- high contrast
- crisp thin black lines

Important:
If the image contains typography or logos, create only the exact outer and inner outline paths of the letters without fills or shading.`,
    expectedOutcome:
      'A centered pure black outline stencil on a clean white background with no shading, fills, texture, gradients, or reinterpretation.',
    expectedImageCount: 1,
  },
  realism: {
    id: 'realism',
    label: 'Realism',
    subtitle: 'Technical red-line stencil and overlay',
    prompt: `Convert the uploaded photograph into a professional high-fidelity technical tattoo stencil.
Generate ONE clean technical stencil on a pure white background.
The backend will create the overlay preview from this exact stencil, so do not include the original photograph, split panels, previews, or before/after layouts in the generated image.

GENERAL STYLE:
- realistic tattoo stencil
- exact linear tracing
- professional tattoo-transfer readability
- no artistic reinterpretation
- preserve original anatomy and expression
- preserve realistic structure and proportions
- tattoo-ready simplification only where necessary

STENCIL LINE STYLE:
- fine uniform red lines
- clean vector-like appearance
- highly readable line hierarchy
- smooth controlled contours
- no rough sketch effect
- no painterly rendering
- no comic style

WHAT MUST BE INCLUDED:
- overall silhouette outline
- exact facial structure
- eyes, eyelids, pupils, eyebrows
- nose structure and nostrils
- lips and expression lines
- ears and accessories
- hair flow and major hair groups
- clothing folds and important fabric structure
- jewelry and objects
- hands with readable anatomy
- important wrinkles and skin folds
- important texture separations useful for tattooing

WHAT MUST BE EXCLUDED OR REDUCED:
- background elements
- blur
- atmosphere
- smoke
- photographic grain
- random micro texture
- unnecessary pores
- excessive noise
- abstract artistic effects

TONAL MAPPING SYSTEM:
Create tonal separation guides using the SAME red stencil line.
The stencil must define:
- solid black areas
- dark tone areas
- mid tone areas
- light tone areas
Use:
- continuous red line for solid, dark, and mid tones
- dashed red line ONLY for highlight/light areas
Do NOT write labels or text indicating tones.
Only outline the tonal regions naturally.

OUTPUT 1 - CLEAN STENCIL:
- pure white background
- stencil only
- no grayscale
- no photo texture
- no shadows
- no realistic rendering
- isolated clean technical stencil

FINAL RESULT:
Generate only the clean red-line tattoo stencil.
Do not include the original photo in the output.
Do not create a collage or side-by-side comparison.`,
    expectedOutcome:
      'Two matched realism outputs: a clean red-line technical stencil on white and the same red stencil overlaid on the original photo.',
    expectedImageCount: 2,
  },
  printhatch: {
    id: 'printhatch',
    label: 'PrintHatch',
    subtitle: 'For stencils from printers',
    prompt: `Convert the uploaded image into a professional engraved tattoo stencil using clean cross-hatching and etching linework, optimized for Bheppo Stencil AI processing and direct tattoo transfer.

STYLE:
- classic engraving / vintage etching aesthetic
- clean cross-hatching shading only
- ultra readable tattoo stencil structure
- black linework on pure white background
- no graywash rendering
- no painterly textures
- no soft realism shading
- no airbrush gradients
- no photographic skin texture

LINEWORK:
- use controlled parallel hatching and cross-hatching for all shadows
- thicker outer contour lines
- medium structural anatomy lines
- fine hatch lines for tonal depth
- directional hatching must follow facial form and anatomy
- preserve open skin breaks for highlights
- avoid muddy black masses
- avoid overpacked hatch density
- maintain clean spacing between lines for stencil readability

SHADING METHOD:
- every shadow must be converted into engraved hatch patterns
- use light and airy crosshatching similar to vintage religious engravings
- prioritize readability over realism
- minimal solid black fills
- use sparse hatch density in light zones
- denser hatch only in deepest shadows
- preserve bright skin areas with negative space

DETAIL PRIORITY:
- preserve exact anatomy and facial expression
- maintain original composition and proportions
- preserve eyes, lips, nose, jewelry, hair flow, fur, fabric folds, and accessories
- simplify micro-textures into tattooable engraved details
- remove unnecessary photographic noise and particles

HAIR & TEXTURE:
- simplify hair into grouped flowing strands
- use elegant etched line flow instead of realistic hair rendering
- fur and fabrics should use directional engraved strokes
- avoid chaotic micro-lines

STENCIL OPTIMIZATION:
- thermal stencil printer friendly
- all lines must remain individually readable after transfer
- no blurry transitions
- no overlapping messy textures
- create clean tattoo application paths
- optimized for professional tattoo stencil extraction

OUTPUT:
- centered vertical composition
- clean white or transparent background
- black engraved line art only
- light crosshatching style
- high readability
- professional tattoo stencil ready for Bheppo AI Stencil processing

NEGATIVE PROMPT:
soft shading, grayscale wash, painterly rendering, blur, charcoal texture, smudges, watercolor, messy sketch, fuzzy edges, heavy black fill, muddy textures, low contrast, photographic grain, realistic rendering, cinematic lighting, smoke, background clutter, airbrush shading, dark overworked crosshatching`,
    expectedOutcome:
      'A printer-friendly engraved tattoo stencil with black etching and cross-hatching only on a clean white or transparent background.',
    expectedImageCount: 1,
  },
};

export const COLOR_THEME_SPECS: Record<TColorThemeId, ThemeSpec> = {
  black: {
    id: 'black',
    label: 'Black',
    renderMode: 'gemini',
    accentHex: '#000000',
    expectedOutcome: 'Overlay selector color only; no additional prompt is applied.',
  },
  red: {
    id: 'red',
    label: 'Red',
    renderMode: 'gemini',
    accentHex: '#CC0000',
    expectedOutcome: 'Overlay selector color only; no additional prompt is applied.',
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    renderMode: 'local_tint',
    accentHex: '#1A6B8A',
    expectedOutcome: 'Overlay selector color only; no additional prompt is applied.',
  },
  green: {
    id: 'green',
    label: 'Green',
    renderMode: 'local_tint',
    accentHex: '#1B7F3A',
    expectedOutcome: 'Overlay selector color only; no additional prompt is applied.',
  },
};

export const STYLE_ALIASES: Record<string, TStencilStyleId> = {
  outline: 'outline',
  pure_outline: 'outline',
  realism: 'realism',
  realism_map: 'realism',
  'realism map': 'realism',
  overlay_realism: 'realism',
  'overlay realism': 'realism',
  detail: 'realism',
  detail_guide: 'realism',
  'detail guide': 'realism',
  printhatch: 'printhatch',
  print_hatch: 'printhatch',
  'print hatch': 'printhatch',
  print: 'printhatch',
  hatch: 'printhatch',
  halftone: 'printhatch',
  halftone_guide: 'printhatch',
  'halftone guide': 'printhatch',
};

export const THEME_ALIASES: Record<string, TColorThemeId> = {
  black: 'black',
  tattoo_black_grey: 'black',
  'tattoo black & grey': 'black',
  red: 'red',
  red_black: 'red',
  red_black_contrast: 'red',
  'red & black contrast': 'red',
  blue: 'blue',
  cobalt: 'blue',
  stencil_cobalt_blue: 'blue',
  'stencil cobalt blue': 'blue',
  deep_blue: 'blue',
  deep_blue_ink: 'blue',
  'deep blue ink': 'blue',
  green: 'green',
  stencil_violet: 'red',
  'stencil violet': 'red',
  sepia: 'black',
  sepia_draft: 'black',
  'sepia draft': 'black',
  super: 'black',
  super_contrast: 'black',
  'super contrast': 'black',
};

export const DEFAULT_STYLE_ID: TStencilStyleId = 'outline';
export const DEFAULT_THEME_ID: TColorThemeId = 'red';
