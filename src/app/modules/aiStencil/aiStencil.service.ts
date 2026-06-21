import {
  GenerateContentResponse,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai';
import { createHash } from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';
import { inspect } from 'util';
import config from '../../config';
import { fileUploader } from '../../utils/fileUploader';
import {
  COLOR_THEME_SPECS,
  DEFAULT_STYLE_ID,
  DEFAULT_THEME_ID,
  STENCIL_PROMPT_VERSION,
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

type TGeneratedImage = {
  base64: string;
  mimeType: string;
};

const GEMINI_IMAGE_MODELS = [
  config.gemini.stencil_model,
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
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

const extractGeneratedImages = (response: GenerateContentResponse): TGeneratedImage[] => {
  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const imageParts = parts.filter((part) => part.inlineData?.data);

  if (imageParts.length === 0) {
    throw new Error('AI did not return image data.');
  }

  return imageParts.map((part) => ({
    base64: part.inlineData!.data,
    mimeType: part.inlineData!.mimeType || 'image/png',
  }));
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

  return styleSpec.prompt;
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
  const stylePromptHash = createHash('sha256')
    .update(STENCIL_STYLE_SPECS[payload.styleId].prompt)
    .digest('hex');
  const parts = [
    STENCIL_PROMPT_VERSION,
    stylePromptHash,
    String(payload.user || 'anonymous'),
    payload.sourceFingerprint || '',
    payload.styleId,
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

const generateStencilImages = async (prompt: string, file: Express.Multer.File) => {
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

      return extractGeneratedImages(result.response);
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

const normalizeGeneratedLineworkImage = async (
  image: TGeneratedImage,
  styleId?: TStencilStyleId,
): Promise<TGeneratedImage> => {
  const lineColor =
    styleId === 'realism'
      ? { red: 220, green: 0, blue: 0 }
      : styleId === 'outline' || styleId === 'printhatch'
        ? { red: 0, green: 0, blue: 0 }
        : null;
  const normalization =
    styleId === 'outline'
      ? { minStrength: 0.1, range: 210, maxStrength: 0.92 }
      : styleId === 'realism'
        ? { minStrength: 0.06, range: 245, maxStrength: 0.86 }
        : { minStrength: 0.05, range: 265, maxStrength: 0.82 };

  if (!lineColor) {
    return image;
  }

  const imageBuffer = Buffer.from(image.base64, 'base64');
  const { data, info } = await sharp(imageBuffer)
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height) {
    return image;
  }

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i] ?? 255;
    const green = data[i + 1] ?? 255;
    const blue = data[i + 2] ?? 255;
    const alpha = data[i + 3] ?? 255;
    const isBackground = alpha < 16 || (red > 246 && green > 246 && blue > 246);

    if (isBackground) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
      continue;
    }

    const brightness = (red + green + blue) / 3;
    const strength = Math.min(
      normalization.maxStrength,
      Math.max(normalization.minStrength, (250 - brightness) / normalization.range),
    );
    data[i] = Math.round(255 - (255 - lineColor.red) * strength);
    data[i + 1] = Math.round(255 - (255 - lineColor.green) * strength);
    data[i + 2] = Math.round(255 - (255 - lineColor.blue) * strength);
    data[i + 3] = 255;
  }

  const normalizedBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  return {
    base64: normalizedBuffer.toString('base64'),
    mimeType: 'image/png',
  };
};

const createTransparentStencilLayer = async (stencilBuffer: Buffer) => {
  const { data, info } = await sharp(stencilBuffer)
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i] ?? 255;
    const green = data[i + 1] ?? 255;
    const blue = data[i + 2] ?? 255;
    const average = (red + green + blue) / 3;
    const isBackground = red > 238 && green > 238 && blue > 238;

    if (isBackground) {
      data[i + 3] = 0;
      continue;
    }

    const opacity = Math.round(Math.min(224, Math.max(82, 255 - average)));
    data[i] = 220;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = opacity;
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
};

const createRealismOverlayImage = async (
  cleanStencilImage: TGeneratedImage,
  sourceFile: Express.Multer.File,
): Promise<TGeneratedImage> => {
  const stencilBuffer = Buffer.from(cleanStencilImage.base64, 'base64');
  const metadata = await sharp(stencilBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  const originalImage = await sharp(sourceFile.buffer)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({ quality: 92 })
    .toBuffer();

  const stencilLayer = await createTransparentStencilLayer(stencilBuffer);
  const overlay = await sharp(originalImage)
    .composite([
      {
        input: stencilLayer,
        blend: 'over',
      },
    ])
    .jpeg({ quality: 94 })
    .toBuffer();

  return {
    base64: overlay.toString('base64'),
    mimeType: 'image/jpeg',
  };
};

const uploadGeneratedStencilSet = async (
  generatedImages: TGeneratedImage[],
  expectedImageCount: number,
  styleId?: TStencilStyleId,
  sourceFile?: Express.Multer.File,
) => {
  const rawCleanImage = generatedImages[0];

  if (!rawCleanImage) {
    throw new Error('AI did not return usable image data.');
  }

  const cleanImage = await normalizeGeneratedLineworkImage(rawCleanImage, styleId);
  const overlayImage =
    styleId === 'realism' && sourceFile
      ? await createRealismOverlayImage(cleanImage, sourceFile)
      : expectedImageCount > 1
        ? generatedImages[1] || cleanImage
        : cleanImage;

  if (cleanImage === overlayImage) {
    const uploadedImage = await uploadGeneratedStencil(cleanImage.base64, cleanImage.mimeType);
    return {
      baseStencilImage: uploadedImage,
      stencilImage: uploadedImage,
    };
  }

  const [baseStencilImage, stencilImage] = await Promise.all([
    uploadGeneratedStencil(cleanImage.base64, cleanImage.mimeType),
    uploadGeneratedStencil(overlayImage.base64, overlayImage.mimeType),
  ]);

  return {
    baseStencilImage,
    stencilImage,
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
  baseImageRef: IAiImageRef = generatedImageRef,
) => {
  payload.baseStencilImage = baseImageRef;
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
    const generatedImages = await generateStencilImages(prompt, workingFile);
    const uploadedStencils = await uploadGeneratedStencilSet(
      generatedImages,
      STENCIL_STYLE_SPECS[normalizedPayload.styleId].expectedImageCount,
      normalizedPayload.styleId,
      workingFile,
    );

    finalizeCompletedPayload(
      normalizedPayload as ReturnType<typeof normalizeStencilPayload> & {
        sourceFingerprint: string;
        generationSignature: string;
      },
      uploadedStencils.stencilImage,
      uploadedStencils.baseStencilImage,
    );

    return await AiStencil.create(normalizedPayload);
  } catch (error: unknown) {
    const { errorCode, errorMessage } = classifyAiError(error, GEMINI_IMAGE_MODELS);
    console.error(`Gemini generation error details: ${formatGeminiError(error)}`);
    console.error('Service Error:', errorMessage);
    normalizedPayload.status = 'FAILED';
    normalizedPayload.isSaved = normalizedPayload.isSaved ?? false;
    normalizedPayload.errorCode = errorCode;
    normalizedPayload.errorMessage = errorMessage;
    return await AiStencil.create(normalizedPayload);
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
    const generatedImages = await generateStencilImages(prompt, file);
    const uploadedStencils = await uploadGeneratedStencilSet(
      generatedImages,
      STENCIL_STYLE_SPECS[normalizedPayload.styleId].expectedImageCount,
      normalizedPayload.styleId,
      file,
    );

    return {
      originalImage: normalizedPayload.originalImage,
      stencilImage: uploadedStencils.stencilImage,
      baseStencilImage: uploadedStencils.baseStencilImage,
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
    const { errorCode, errorMessage } = classifyAiError(error, GEMINI_IMAGE_MODELS);
    console.error(`Gemini gallery preview error details: ${formatGeminiError(error)}`);

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
      errorMessage,
    };
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
