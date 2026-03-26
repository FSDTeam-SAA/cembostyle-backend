import {
  GenerateContentResponse,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai';
import { IAiStencil, TStencilErrorCode } from './aiStencil.interface';
import { AiStencil } from './aiStencil.model';
import config from '../../config';
import { STENCIL_PROMPTS } from './aiStencil.constant';
import { fileUploader } from '../../utils/fileUploader';
import path from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';

const DEFAULT_GEMINI_TIMEOUT_MS = 60000;
const configuredGeminiTimeout = Number(config.gemini.timeout_ms);
const GEMINI_TIMEOUT_MS =
  Number.isFinite(configuredGeminiTimeout) && configuredGeminiTimeout > 0
    ? configuredGeminiTimeout
    : DEFAULT_GEMINI_TIMEOUT_MS;
const GEMINI_IMAGE_MODELS = [
  config.gemini.stencil_model,
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-2.0-flash-exp-image-generation',
].filter(
  (model, index, models): model is string => Boolean(model) && models.indexOf(model) === index,
);
const STENCIL_STYLES = Object.keys(STENCIL_PROMPTS) as Array<keyof typeof STENCIL_PROMPTS>;

const getGenerativeAIClient = () => {
  if (!config.gemini.api_key) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  return new GoogleGenerativeAI(config.gemini.api_key);
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number) => {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(
      () =>
        reject(
          Object.assign(new Error(`AI Timeout after ${Math.ceil(timeoutMs / 1000)}s`), {
            status: 504,
          }),
        ),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]);
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

const classifyAiError = (
  error: unknown,
  attemptedModels: string[],
): { errorCode: TStencilErrorCode; errorMessage: string } => {
  const status = (error as { status?: number })?.status;
  const message = (error as Error)?.message || 'Unknown AI error';
  const primaryModel = attemptedModels[0] || 'configured Gemini image model';

  if (status === 504 || message.includes('AI Timeout')) {
    return {
      errorCode: 'AI_TIMEOUT',
      errorMessage: `Gemini image generation timed out after ${Math.ceil(GEMINI_TIMEOUT_MS / 1000)}s.`,
    };
  }

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

const normalizeStyle = (style?: string) => {
  if (style && STENCIL_STYLES.includes(style as (typeof STENCIL_STYLES)[number])) {
    return style as keyof typeof STENCIL_PROMPTS;
  }

  return 'Outline';
};

const getDetailDescriptor = (detailLevel?: number) => {
  switch (detailLevel) {
    case 0:
      return 'Simple';
    case 1:
      return 'Basic';
    case 2:
    case 3:
      return 'Sketch';
    default:
      return '';
  }
};

const buildStencilPrompt = (payload: Partial<IAiStencil>) => {
  const normalizedStyle = normalizeStyle(payload.style);
  const detailDescriptor = getDetailDescriptor(payload.detailLevel);
  const promptParts = [STENCIL_PROMPTS[normalizedStyle]];

  if (payload.colorTheme) {
    promptParts.push(
      `Use the visual treatment "${payload.colorTheme}" only when it helps readability and line separation.`,
    );
  }

  if (detailDescriptor) {
    promptParts.push(
      `Target detail level: ${detailDescriptor}. Keep the output suitable as a tattoo stencil reference.`,
    );
  }

  if (typeof payload.brightness === 'number') {
    promptParts.push(`Approximate source brightness preference: ${payload.brightness.toFixed(2)}.`);
  }

  if (typeof payload.contrast === 'number') {
    promptParts.push(`Approximate source contrast preference: ${payload.contrast.toFixed(2)}.`);
  }

  promptParts.push('Return the transformed result as an image only. Do not include a text description.');
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
      console.log(`2. Requesting AI Generation with ${modelName}...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      const result = await withTimeout(
        model.generateContent([{ text: prompt }, imagePart]),
        GEMINI_TIMEOUT_MS,
      );

      return extractGeneratedImage(result.response);
    } catch (error) {
      lastError = error;

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

const createStencil = async (payload: IAiStencil, file: Express.Multer.File) => {
  try {
    console.log('1. Uploading original to Cloudinary...');
    const uploadedOriginal = await fileUploader.uploadToCloudinary(file);
    payload.originalImage = {
      url: uploadedOriginal.url,
      publicId: uploadedOriginal.public_id,
    };

    payload.style = normalizeStyle(payload.style);
    const prompt = buildStencilPrompt(payload);
    const generatedImage = await generateStencilImage(prompt, file);

    console.log('3. Uploading Stencil to Cloudinary...');
    const uploadedStencil = await fileUploader.uploadBase64ToCloudinary(
      generatedImage.base64,
      generatedImage.mimeType,
    );

    payload.stencilImage = {
      url: uploadedStencil.url,
      publicId: uploadedStencil.public_id,
    };
    payload.status = 'COMPLETED';
    delete payload.errorCode;
    delete payload.errorMessage;

    return await AiStencil.create(payload);
  } catch (error: unknown) {
    try {
      console.warn('Gemini generation failed, falling back to local stencil processing.');
      const fallbackImage = await generateStencilFallback(file, payload);
      const uploadedStencil = await fileUploader.uploadBase64ToCloudinary(
        fallbackImage.base64,
        fallbackImage.mimeType,
      );

      payload.stencilImage = {
        url: uploadedStencil.url,
        publicId: uploadedStencil.public_id,
      };
      payload.status = 'COMPLETED';
      delete payload.errorCode;
      delete payload.errorMessage;

      return await AiStencil.create(payload);
    } catch (fallbackError: unknown) {
      const { errorCode, errorMessage } = classifyAiError(error, GEMINI_IMAGE_MODELS);
      console.error('Service Error:', errorMessage, fallbackError);
      payload.status = 'FAILED';
      payload.errorCode = errorCode;
      payload.errorMessage = errorMessage;
      return await AiStencil.create(payload);
    }
  }
};

const createGalleryPreview = async (
  payload: Partial<IAiStencil> & {
    originalImage: {
      url: string;
      publicId: string;
    };
  },
) => {
  const normalizedStyle = normalizeStyle(payload.style);

  try {
    const file = await createMulterFileFromUrl(payload.originalImage.url);
    const prompt = buildStencilPrompt({
      ...payload,
      style: normalizedStyle,
    });
    const generatedImage = await generateStencilImage(prompt, file);
    const uploadedStencil = await fileUploader.uploadBase64ToCloudinary(
      generatedImage.base64,
      generatedImage.mimeType,
    );

    return {
      originalImage: payload.originalImage,
      stencilImage: {
        url: uploadedStencil.url,
        publicId: uploadedStencil.public_id,
      },
      style: normalizedStyle,
      colorTheme: payload.colorTheme || '',
      detailLevel: payload.detailLevel ?? 1,
      brightness: payload.brightness ?? 0.8,
      contrast: payload.contrast ?? 0.6,
      status: 'COMPLETED' as const,
      errorCode: undefined,
      errorMessage: undefined,
    };
  } catch (error: unknown) {
    try {
      console.warn('Gemini gallery preview failed, using local stencil fallback.');
      const file = await createMulterFileFromUrl(payload.originalImage.url);
      const fallbackImage = await generateStencilFallback(file, payload);
      const uploadedStencil = await fileUploader.uploadBase64ToCloudinary(
        fallbackImage.base64,
        fallbackImage.mimeType,
      );

      return {
        originalImage: payload.originalImage,
        stencilImage: {
          url: uploadedStencil.url,
          publicId: uploadedStencil.public_id,
        },
        style: normalizedStyle,
        colorTheme: payload.colorTheme || '',
        detailLevel: payload.detailLevel ?? 1,
        brightness: payload.brightness ?? 0.8,
        contrast: payload.contrast ?? 0.6,
        status: 'COMPLETED' as const,
        errorCode: undefined,
        errorMessage: undefined,
      };
    } catch (fallbackError: unknown) {
      const { errorCode, errorMessage } = classifyAiError(error, GEMINI_IMAGE_MODELS);

      return {
        originalImage: payload.originalImage,
        stencilImage: undefined,
        style: normalizedStyle,
        colorTheme: payload.colorTheme || '',
        detailLevel: payload.detailLevel ?? 1,
        brightness: payload.brightness ?? 0.8,
        contrast: payload.contrast ?? 0.6,
        status: 'FAILED' as const,
        errorCode,
        errorMessage: `${errorMessage} Local fallback also failed: ${(fallbackError as Error).message}`,
      };
    }
  }
};

const getMyAllStencil = async (userId: string) => {
  const data = await AiStencil.find({ user: userId });
  const count = await AiStencil.countDocuments({ user: userId });
  return { data, count };
};

const updateStencil = async (id: string, userId: string, payload: Partial<IAiStencil>) => {
  const result = await AiStencil.findOneAndUpdate({ _id: id, user: userId }, payload, {
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
