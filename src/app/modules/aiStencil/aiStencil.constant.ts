import { TColorThemeId, TStencilStyleId, TThemeRenderMode } from './aiStencil.interface';

type StyleSpec = {
  id: TStencilStyleId;
  label: string;
  subtitle: string;
  prompt: string;
  expectedOutcome: string;
};

type ThemeSpec = {
  id: TColorThemeId;
  label: string;
  renderMode: TThemeRenderMode;
  accentHex: string;
  prompt?: string;
  expectedOutcome: string;
};

export const STENCIL_STYLE_SPECS: Record<TStencilStyleId, StyleSpec> = {
  outline: {
    id: 'outline',
    label: 'Outline',
    subtitle: 'Simple clean transfer lines',
    prompt:
      'Transform the subject into a tattoo-ready outline stencil. Preserve the main silhouette, facial landmarks, and the most important contour lines. Use crisp dark linework on a bright clean background. Remove painterly shading, color noise, and unnecessary texture so the result reads clearly as a transfer reference.',
    expectedOutcome:
      'A clean black-on-white outline stencil with only the essential contour lines and no shading.',
  },
  realism_map: {
    id: 'realism_map',
    label: 'Realism Map',
    subtitle: 'Grayscale value map for depth and shading',
    prompt:
      'Transform the subject into a realism shading map for tattoo planning. Keep the anatomy accurate and convert the image into a smooth grayscale value study with readable depth, planes, and volume transitions. Preserve important shadows and highlight separation while avoiding decorative color or comic-style simplification.',
    expectedOutcome:
      'A grayscale value map that preserves anatomy, shadow structure, and depth without decorative styling.',
  },
  detail_guide: {
    id: 'detail_guide',
    label: 'Detail Guide',
    subtitle: 'Texture and landmark guide',
    prompt:
      'Transform the subject into a detail guide for tattoo execution. Preserve edge landmarks, texture groupings, folds, fur direction, and secondary micro-forms that help the artist place detail correctly. Keep the result organized and readable rather than overly noisy.',
    expectedOutcome:
      'A readable detail guide that keeps useful texture, structure, and landmark information for tattoo placement.',
  },
  halftone_guide: {
    id: 'halftone_guide',
    label: 'Halftone Guide',
    subtitle: 'Dot-shaded guide for print-style shading',
    prompt:
      'Transform the subject into a halftone tattoo guide. Use controlled dot-based shading and clean structure so the subject remains readable. Preserve major forms and value separation while converting tonal areas into deliberate halftone patterns instead of smooth gradients.',
    expectedOutcome:
      'A dot-shaded stencil guide with controlled halftone patterns and strong readability.',
  },
};

export const COLOR_THEME_SPECS: Record<TColorThemeId, ThemeSpec> = {
  tattoo_black_grey: {
    id: 'tattoo_black_grey',
    label: 'Tattoo Black & Grey',
    renderMode: 'gemini',
    accentHex: '#1F1F1F',
    prompt:
      'Render the final image strictly as a tattoo black-and-grey piece. Use neutral blacks, charcoal greys, and clean white paper. Do not introduce blue, violet, sepia, or red accents.',
    expectedOutcome:
      'A neutral black-and-grey stencil result with no color tinting and clean tonal separation.',
  },
  stencil_violet: {
    id: 'stencil_violet',
    label: 'Stencil Violet',
    renderMode: 'local_tint',
    accentHex: '#7A4BFF',
    expectedOutcome: 'A locally tinted violet stencil with crisp line visibility and no model recoloring.',
  },
  stencil_cobalt_blue: {
    id: 'stencil_cobalt_blue',
    label: 'Stencil Cobalt Blue',
    renderMode: 'local_tint',
    accentHex: '#2859C5',
    expectedOutcome: 'A locally tinted cobalt-blue stencil with crisp line visibility and no model recoloring.',
  },
  red_black_contrast: {
    id: 'red_black_contrast',
    label: 'Red & Black Contrast',
    renderMode: 'gemini',
    accentHex: '#B42318',
    prompt:
      'Render the final image with black primary linework and restrained deep-red guide accents only where they improve readability. Keep the artwork clean, intentional, and suitable for stencil reference. Do not flood the image with red.',
    expectedOutcome:
      'A high-contrast black-and-red stencil result with restrained accents and strong readability.',
  },
  deep_blue_ink: {
    id: 'deep_blue_ink',
    label: 'Deep Blue Ink',
    renderMode: 'local_tint',
    accentHex: '#1D4F91',
    expectedOutcome: 'A locally tinted deep-blue stencil with crisp line visibility and no model recoloring.',
  },
  sepia_draft: {
    id: 'sepia_draft',
    label: 'Sepia Draft',
    renderMode: 'local_tint',
    accentHex: '#8A5A3B',
    expectedOutcome: 'A locally tinted sepia draft stencil with crisp line visibility and no model recoloring.',
  },
  super_contrast: {
    id: 'super_contrast',
    label: 'Super Contrast',
    renderMode: 'gemini',
    accentHex: '#111111',
    prompt:
      'Render the final image with extreme black-and-white separation. Push line clarity and edge definition, minimize muddy midtones, and keep the result printable and stencil-readable.',
    expectedOutcome:
      'An aggressively separated black-and-white stencil with maximum readability and minimal midtones.',
  },
};

export const STYLE_ALIASES: Record<string, TStencilStyleId> = {
  outline: 'outline',
  realism: 'realism_map',
  realism_map: 'realism_map',
  'realism map': 'realism_map',
  detail: 'detail_guide',
  detail_guide: 'detail_guide',
  'detail guide': 'detail_guide',
  halftone: 'halftone_guide',
  halftone_guide: 'halftone_guide',
  'halftone guide': 'halftone_guide',
};

export const THEME_ALIASES: Record<string, TColorThemeId> = {
  black: 'tattoo_black_grey',
  tattoo_black_grey: 'tattoo_black_grey',
  'tattoo black & grey': 'tattoo_black_grey',
  stencil_violet: 'stencil_violet',
  'stencil violet': 'stencil_violet',
  cobalt: 'stencil_cobalt_blue',
  stencil_cobalt_blue: 'stencil_cobalt_blue',
  'stencil cobalt blue': 'stencil_cobalt_blue',
  red_black: 'red_black_contrast',
  red_black_contrast: 'red_black_contrast',
  'red & black contrast': 'red_black_contrast',
  deep_blue: 'deep_blue_ink',
  deep_blue_ink: 'deep_blue_ink',
  'deep blue ink': 'deep_blue_ink',
  sepia: 'sepia_draft',
  sepia_draft: 'sepia_draft',
  'sepia draft': 'sepia_draft',
  super: 'super_contrast',
  super_contrast: 'super_contrast',
  'super contrast': 'super_contrast',
};

export const DEFAULT_STYLE_ID: TStencilStyleId = 'outline';
export const DEFAULT_THEME_ID: TColorThemeId = 'tattoo_black_grey';
