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

const createStencil = async (payload: IAiStencil, file: Express.Multer.File) => {
  try {
    console.log('1. Uploading original to Cloudinary...');
    const uploadedOriginal = await fileUploader.uploadToCloudinary(file);
    payload.originalImage = {
      url: uploadedOriginal.url,
      publicId: uploadedOriginal.public_id,
    };

    const prompt = `${STENCIL_PROMPTS[payload.style]} Return the transformed result as an image only. Do not include a text description.`;
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
    const { errorCode, errorMessage } = classifyAiError(error, GEMINI_IMAGE_MODELS);
    console.error('Service Error:', errorMessage);
    payload.status = 'FAILED';
    payload.errorCode = errorCode;
    payload.errorMessage = errorMessage;
    // Ensure we still create a record so the controller gets a 'result'
    return await AiStencil.create(payload);
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
  getMyAllStencil,
  updateStencil,
  deleteStencil,
};
