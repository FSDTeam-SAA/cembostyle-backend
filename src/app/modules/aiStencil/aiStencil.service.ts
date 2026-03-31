import {
  GenerateContentResponse,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai';
import { createHash } from 'crypto';
import path from 'path';
import { Readable } from 'stream';
import { inspect } from 'util';
import sharp from 'sharp';
import config from '../../config';
import { fileUploader } from '../../utils/fileUploader';
import {
  COLOR_THEME_SPECS,
  DEFAULT_STYLE_ID,
  DEFAULT_THEME_ID,
  STENCIL_STYLE_SPECS,
  STYLE_ALIASES,
  THEME_ALIASES,
} from './aiStencil.constant';
import {
  IAiImageRef,
  IAiStencil,
  TColorThemeId,
  TStencilErrorCode,
  TStencilStyleId,
  TThemeRenderMode,
} from './aiStencil.interface';
import { AiStencil } from './aiStencil.model';

const GEMINI_IMAGE_MODELS = [
  config.gemini.stencil_model,
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-2.0-flash-exp-image-generation',
].filter(
  (model, index, models): model is string => Boolean(model) && models.indexOf(model) === index,
);

const getGenerativeAIClient = () => {
  if (!config.gemini.api_key) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  return new GoogleGenerativeAI(config.gemini.api_key);
};

const extractGeneratedImage = (response: GenerateContentResponse) => {
  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error('AI did not return image data.');
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
};

const shouldTryNextModel = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  const message = (error as Error)?.message?.toLowerCase() || '';

  return (
    status === 404 ||
    message.includes('not found for api version') ||
    message.includes('is not supported for generatecontent')
  );
};

const formatGeminiError = (error: unknown) => {
  if (error instanceof Error) {
    const geminiError = error as Error & {
      status?: number;
      response?: unknown;
      details?: unknown;
      errorDetails?: unknown;
      cause?: unknown;
    };

    return inspect(
      {
        name: geminiError.name,
        message: geminiError.message,
        status: geminiError.status,
        details: geminiError.details,
        errorDetails: geminiError.errorDetails,
        response: geminiError.response,
        cause: geminiError.cause,
        stack: geminiError.stack,
      },
      {
        depth: 10,
        colors: false,
      },
    );
  }

  return inspect(error, {
    depth: 10,
    colors: false,
  });
};

const classifyAiError = (
  error: unknown,
  attemptedModels: string[],
): { errorCode: TStencilErrorCode; errorMessage: string } => {
  const status = (error as { status?: number })?.status;
  const message = (error as Error)?.message || 'Unknown AI error';
  const primaryModel = attemptedModels[0] || 'configured Gemini image model';

  if (status === 429 || /quota exceeded|too many requests/i.test(message)) {
    return {
      errorCode: 'AI_QUOTA_EXCEEDED',
      errorMessage: `Gemini image generation quota is unavailable for ${primaryModel}. Enable billing or use a Gemini key/project with image-generation quota.`,
    };
  }

  if (
    status === 404 ||
    /not found for api version|is not supported for generatecontent/i.test(message)
  ) {
    return {
      errorCode: 'AI_MODEL_UNAVAILABLE',
      errorMessage: `No configured Gemini image model is available for this API key. Tried: ${attemptedModels.join(', ')}.`,
    };
  }

  if (/did not return image data|unable to process input image/i.test(message)) {
    return {
      errorCode: 'AI_BAD_RESPONSE',
      errorMessage: 'Gemini did not return an edited image for the supplied file.',
    };
  }

  return {
    errorCode: 'AI_PROCESSING_FAILED',
    errorMessage: message,
  };
};

const normalizeKey = (value?: string) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') ?? '';

const normalizeStyleId = (value?: string): TStencilStyleId => {
  const normalizedValue = value?.trim() ?? '';

  if (normalizedValue in STENCIL_STYLE_SPECS) {
    return normalizedValue as TStencilStyleId;
  }

  const alias = STYLE_ALIASES[normalizeKey(normalizedValue)] || STYLE_ALIASES[normalizedValue.toLowerCase()];
  return alias || DEFAULT_STYLE_ID;
};

const normalizeThemeId = (value?: string): TColorThemeId => {
  const normalizedValue = value?.trim() ?? '';

  if (normalizedValue in COLOR_THEME_SPECS) {
    return normalizedValue as TColorThemeId;
  }

  const alias = THEME_ALIASES[normalizeKey(normalizedValue)] || THEME_ALIASES[normalizedValue.toLowerCase()];
  return alias || DEFAULT_THEME_ID;
};

const getDetailDescriptor = (detailLevel?: number) => {
  switch (detailLevel) {
    case 0:
      return 'Keep the result simple and uncluttered.';
    case 1:
      return 'Keep a balanced amount of usable detail.';
    case 2:
      return 'Keep rich detail while preserving readability.';
    default:
      return 'Keep a balanced amount of usable detail.';
  }
};

const normalizeNumericPreference = (
  value: unknown,
  fallback: number,
  { min = 0, max = 1 }: { min?: number; max?: number } = {},
) => {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const normalizeImageRef = (value?: Partial<IAiImageRef> | null): IAiImageRef | undefined => {
  if (!value?.url) {
    return undefined;
  }

  return {
    url: value.url,
    publicId: value.publicId || '',
  };
};

const normalizeStencilPayload = (payload: Partial<IAiStencil>) => {
  const styleId = normalizeStyleId(payload.styleId || payload.style);
  const colorThemeId = normalizeThemeId(payload.colorThemeId || payload.colorTheme);
  const styleSpec = STENCIL_STYLE_SPECS[styleId];
  const themeSpec = COLOR_THEME_SPECS[colorThemeId];
  const detailLevel = Math.round(normalizeNumericPreference(payload.detailLevel, 1, { min: 0, max: 2 }));
  const brightness = normalizeNumericPreference(payload.brightness, 0.8);
  const contrast = normalizeNumericPreference(payload.contrast, 0.6);

  return {
    ...payload,
    originalImage: normalizeImageRef(payload.originalImage),
    stencilImage: normalizeImageRef(payload.stencilImage),
    baseStencilImage: normalizeImageRef(payload.baseStencilImage),
    styleId,
    style: styleSpec.label,
    colorThemeId,
    colorTheme: themeSpec.label,
    themeRenderMode: themeSpec.renderMode,
    detailLevel,
    brightness,
    contrast,
  } as Partial<IAiStencil> & {
    styleId: TStencilStyleId;
    colorThemeId: TColorThemeId;
    themeRenderMode: TThemeRenderMode;
    style: string;
    colorTheme: string;
    detailLevel: number;
    brightness: number;
    contrast: number;
  };
};

const buildStencilPrompt = (payload: Partial<IAiStencil>) => {
  const normalized = normalizeStencilPayload(payload);
  const styleSpec = STENCIL_STYLE_SPECS[normalized.styleId];
  const themeSpec = COLOR_THEME_SPECS[normalized.colorThemeId];
  const promptParts = [
    styleSpec.prompt,
    getDetailDescriptor(normalized.detailLevel),
    `Source brightness preference: ${normalized.brightness.toFixed(2)}.`,
    `Source contrast preference: ${normalized.contrast.toFixed(2)}.`,
  ];

  if (themeSpec.renderMode === 'gemini' && themeSpec.prompt) {
    promptParts.push(themeSpec.prompt);
  } else {
    promptParts.push(
      'Keep the generated result as a neutral monochrome sketch with strong dark lines on a bright background so it can be safely recolored locally with a single ink tint.',
    );
  }

  promptParts.push(
    'Return the transformed result as an image only. Do not include a text description.',
  );

  return promptParts.join(' ');
};

const createMulterFileFromUrl = async (imageUrl: string) => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download gallery image (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const fileName = path.basename(new URL(imageUrl).pathname) || `gallery-${Date.now()}.jpg`;

  return {
    fieldname: 'file',
    originalname: fileName,
    encoding: '7bit',
    mimetype: mimeType,
    size: buffer.length,
    buffer,
    stream: Readable.from(buffer),
    destination: '',
    filename: fileName,
    path: '',
  } as unknown as Express.Multer.File;
};

const createSourceFingerprint = (file?: Express.Multer.File, originalImage?: IAiImageRef) => {
  if (file?.buffer?.length) {
    return createHash('sha256').update(file.buffer).digest('hex');
  }

  if (originalImage?.publicId) {
    return createHash('sha256').update(originalImage.publicId).digest('hex');
  }

  if (originalImage?.url) {
    return createHash('sha256').update(originalImage.url).digest('hex');
  }

  return createHash('sha256').update(`unknown-source-${Date.now()}`).digest('hex');
};

const buildGenerationSignature = (
  payload: ReturnType<typeof normalizeStencilPayload> & { user?: IAiStencil['user'] },
) => {
  const parts = [
    String(payload.user || 'anonymous'),
    payload.sourceFingerprint || '',
    payload.styleId,
    payload.colorThemeId,
    payload.themeRenderMode,
    String(payload.detailLevel),
    payload.brightness.toFixed(2),
    payload.contrast.toFixed(2),
  ];

  return createHash('sha256').update(parts.join('::')).digest('hex');
};

const uploadOriginalIfNeeded = async (
  payload: ReturnType<typeof normalizeStencilPayload>,
  file?: Express.Multer.File,
) => {
  if (payload.originalImage?.url || !file) {
    return payload.originalImage;
  }

  const startedAt = Date.now();
  console.log('1. Uploading original to Cloudinary...');
  const uploadedOriginal = await fileUploader.uploadToCloudinary(file);
  console.log(`Original upload completed in ${Date.now() - startedAt}ms`);

  return {
    url: uploadedOriginal.url,
    publicId: uploadedOriginal.public_id,
  };
};

const generateStencilImage = async (prompt: string, file: Express.Multer.File) => {
  if (GEMINI_IMAGE_MODELS.length === 0) {
    throw new Error('No Gemini image model is configured.');
  }

  const genAI = getGenerativeAIClient();
  const imagePart = {
    inlineData: {
      data: file.buffer.toString('base64'),
      mimeType: file.mimetype,
    },
  };

  let lastError: unknown;

  for (const modelName of GEMINI_IMAGE_MODELS) {
    try {
      console.log(`2. Requesting AI generation with ${modelName}...`);
      const startedAt = Date.now();

      const model = genAI.getGenerativeModel({
        model: modelName,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      const result = await model.generateContent([{ text: prompt }, imagePart]);
      console.log(`Gemini generation completed in ${Date.now() - startedAt}ms`);

      return extractGeneratedImage(result.response);
    } catch (error) {
      lastError = error;
      console.error(`Gemini model ${modelName} failed: ${formatGeminiError(error)}`);

      if (shouldTryNextModel(error)) {
        console.warn(`Gemini model ${modelName} is unavailable, trying next fallback.`);
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error('Gemini image generation failed.');
};

const generateStencilFallback = async (
  file: Express.Multer.File,
  payload: Partial<IAiStencil>,
) => {
  const detailLevel = payload.detailLevel ?? 1;
  const contrast = payload.contrast ?? 0.6;
  const brightness = payload.brightness ?? 0.8;
  const threshold = detailLevel >= 2 ? 172 : 188;
  const alpha = 1.2 + contrast * 0.8;
  const beta = Math.round((brightness - 0.5) * 42);

  const stencilBuffer = await sharp(file.buffer)
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .normalise()
    .linear(alpha, beta)
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
    })
    .negate()
    .threshold(threshold)
    .png()
    .toBuffer();

  return {
    base64: stencilBuffer.toString('base64'),
    mimeType: 'image/png',
  };
};

const uploadGeneratedStencil = async (base64: string, mimeType: string) => {
  const startedAt = Date.now();
  console.log('3. Uploading stencil to Cloudinary...');
  const uploadedStencil = await fileUploader.uploadBase64ToCloudinary(base64, mimeType);
  console.log(`Generated image upload completed in ${Date.now() - startedAt}ms`);

  return {
    url: uploadedStencil.url,
    publicId: uploadedStencil.public_id,
  };
};

const findCachedStencil = async (
  payload: ReturnType<typeof normalizeStencilPayload> & { generationSignature?: string; user?: IAiStencil['user'] },
) => {
  if (!payload.user || !payload.generationSignature) {
    return null;
  }

  const startedAt = Date.now();
  const cached = await AiStencil.findOne({
    user: payload.user,
    generationSignature: payload.generationSignature,
    status: 'COMPLETED',
  }).sort({ updatedAt: -1 });

  console.log(
    `Stencil cache ${cached ? 'hit' : 'miss'} for ${payload.generationSignature} in ${Date.now() - startedAt}ms`,
  );

  return cached;
};

const finalizeCompletedPayload = (
  payload: ReturnType<typeof normalizeStencilPayload> & {
    sourceFingerprint: string;
    generationSignature: string;
  },
  generatedImageRef: IAiImageRef,
) => {
  payload.baseStencilImage = generatedImageRef;
  payload.stencilImage = generatedImageRef;
  payload.isSaved = payload.isSaved ?? false;
  payload.status = 'COMPLETED';
  delete payload.errorCode;
  delete payload.errorMessage;

  return payload;
};

const ensureWorkingFile = async (
  payload: ReturnType<typeof normalizeStencilPayload>,
  file?: Express.Multer.File,
) => {
  if (file) {
    return file;
  }

  if (payload.originalImage?.url) {
    return createMulterFileFromUrl(payload.originalImage.url);
  }

  throw new Error('Image file or original image reference is required.');
};

const createStencil = async (payload: IAiStencil, file?: Express.Multer.File) => {
  const normalizedPayload = normalizeStencilPayload(payload);

  try {
    const originalImage = await uploadOriginalIfNeeded(normalizedPayload, file);
    if (originalImage) {
      normalizedPayload.originalImage = originalImage;
    }

    const workingFile = await ensureWorkingFile(normalizedPayload, file);
    normalizedPayload.sourceFingerprint = createSourceFingerprint(workingFile, normalizedPayload.originalImage);
    normalizedPayload.generationSignature = buildGenerationSignature({
      ...normalizedPayload,
      sourceFingerprint: normalizedPayload.sourceFingerprint,
    });

    const cachedStencil = await findCachedStencil(normalizedPayload);
    if (cachedStencil) {
      return cachedStencil;
    }

    const prompt = buildStencilPrompt(normalizedPayload);
    const generatedImage = await generateStencilImage(prompt, workingFile);
    const uploadedStencil = await uploadGeneratedStencil(generatedImage.base64, generatedImage.mimeType);

    finalizeCompletedPayload(
      normalizedPayload as ReturnType<typeof normalizeStencilPayload> & {
        sourceFingerprint: string;
        generationSignature: string;
      },
      uploadedStencil,
    );

    return await AiStencil.create(normalizedPayload);
  } catch (error: unknown) {
    try {
      console.error(`Gemini generation error details: ${formatGeminiError(error)}`);
      console.warn('Gemini generation failed, falling back to local stencil processing.');

      if (!normalizedPayload.originalImage) {
        const originalImage = await uploadOriginalIfNeeded(normalizedPayload, file);
        if (originalImage) {
          normalizedPayload.originalImage = originalImage;
        }
      }
      const workingFile = await ensureWorkingFile(normalizedPayload, file);
      normalizedPayload.sourceFingerprint =
        normalizedPayload.sourceFingerprint ||
        createSourceFingerprint(workingFile, normalizedPayload.originalImage);
      normalizedPayload.generationSignature =
        normalizedPayload.generationSignature ||
        buildGenerationSignature({
          ...normalizedPayload,
          sourceFingerprint: normalizedPayload.sourceFingerprint,
        });

      const fallbackImage = await generateStencilFallback(workingFile, normalizedPayload);
      const uploadedStencil = await uploadGeneratedStencil(fallbackImage.base64, fallbackImage.mimeType);

      finalizeCompletedPayload(
        normalizedPayload as ReturnType<typeof normalizeStencilPayload> & {
          sourceFingerprint: string;
          generationSignature: string;
        },
        uploadedStencil,
      );

      return await AiStencil.create(normalizedPayload);
    } catch (fallbackError: unknown) {
      const { errorCode, errorMessage } = classifyAiError(error, GEMINI_IMAGE_MODELS);
      console.error('Service Error:', errorMessage, fallbackError);
      normalizedPayload.status = 'FAILED';
      normalizedPayload.isSaved = normalizedPayload.isSaved ?? false;
      normalizedPayload.errorCode = errorCode;
      normalizedPayload.errorMessage = errorMessage;
      return await AiStencil.create(normalizedPayload);
    }
  }
};

const createGalleryPreview = async (
  payload: Partial<IAiStencil> & {
    originalImage: IAiImageRef;
  },
) => {
  const normalizedPayload = normalizeStencilPayload(payload);

  try {
    const file = await ensureWorkingFile(normalizedPayload);
    const prompt = buildStencilPrompt(normalizedPayload);
    const generatedImage = await generateStencilImage(prompt, file);
    const uploadedStencil = await uploadGeneratedStencil(generatedImage.base64, generatedImage.mimeType);

    return {
      originalImage: normalizedPayload.originalImage,
      stencilImage: uploadedStencil,
      baseStencilImage: uploadedStencil,
      style: normalizedPayload.style,
      styleId: normalizedPayload.styleId,
      colorTheme: normalizedPayload.colorTheme,
      colorThemeId: normalizedPayload.colorThemeId,
      themeRenderMode: normalizedPayload.themeRenderMode,
      detailLevel: normalizedPayload.detailLevel,
      brightness: normalizedPayload.brightness,
      contrast: normalizedPayload.contrast,
      status: 'COMPLETED' as const,
      errorCode: undefined,
      errorMessage: undefined,
    };
  } catch (error: unknown) {
    try {
      console.error(`Gemini gallery preview error details: ${formatGeminiError(error)}`);
      console.warn('Gemini gallery preview failed, using local stencil fallback.');
      const file = await ensureWorkingFile(normalizedPayload);
      const fallbackImage = await generateStencilFallback(file, normalizedPayload);
      const uploadedStencil = await uploadGeneratedStencil(fallbackImage.base64, fallbackImage.mimeType);

      return {
        originalImage: normalizedPayload.originalImage,
        stencilImage: uploadedStencil,
        baseStencilImage: uploadedStencil,
        style: normalizedPayload.style,
        styleId: normalizedPayload.styleId,
        colorTheme: normalizedPayload.colorTheme,
        colorThemeId: normalizedPayload.colorThemeId,
        themeRenderMode: normalizedPayload.themeRenderMode,
        detailLevel: normalizedPayload.detailLevel,
        brightness: normalizedPayload.brightness,
        contrast: normalizedPayload.contrast,
        status: 'COMPLETED' as const,
        errorCode: undefined,
        errorMessage: undefined,
      };
    } catch (fallbackError: unknown) {
      const { errorCode, errorMessage } = classifyAiError(error, GEMINI_IMAGE_MODELS);

      return {
        originalImage: normalizedPayload.originalImage,
        stencilImage: undefined,
        baseStencilImage: undefined,
        style: normalizedPayload.style,
        styleId: normalizedPayload.styleId,
        colorTheme: normalizedPayload.colorTheme,
        colorThemeId: normalizedPayload.colorThemeId,
        themeRenderMode: normalizedPayload.themeRenderMode,
        detailLevel: normalizedPayload.detailLevel,
        brightness: normalizedPayload.brightness,
        contrast: normalizedPayload.contrast,
        status: 'FAILED' as const,
        errorCode,
        errorMessage: `${errorMessage} Local fallback also failed: ${(fallbackError as Error).message}`,
      };
    }
  }
};

const getMyAllStencil = async (userId: string) => {
  const query = { user: userId, isSaved: true };
  const data = await AiStencil.find(query);
  const count = await AiStencil.countDocuments(query);
  return { data, count };
};

const updateStencil = async (id: string, userId: string, payload: Partial<IAiStencil>) => {
  const updatePayload: Partial<IAiStencil> = { ...payload };

  if (payload.style || payload.styleId || payload.colorTheme || payload.colorThemeId) {
    const normalizedPayload = normalizeStencilPayload(payload);
    updatePayload.style = normalizedPayload.style;
    updatePayload.styleId = normalizedPayload.styleId;
    updatePayload.colorTheme = normalizedPayload.colorTheme;
    updatePayload.colorThemeId = normalizedPayload.colorThemeId;
    updatePayload.themeRenderMode = normalizedPayload.themeRenderMode;
  }

  const result = await AiStencil.findOneAndUpdate({ _id: id, user: userId }, updatePayload, {
    new: true,
  });
  return result;
};

const deleteStencil = async (id: string, userId: string) => {
  const result = await AiStencil.findOneAndDelete({ _id: id, user: userId });
  return result;
};

export const AiStencilService = {
  createStencil,
  createGalleryPreview,
  getMyAllStencil,
  updateStencil,
  deleteStencil,
};
