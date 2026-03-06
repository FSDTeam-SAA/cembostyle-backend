import { IAiStencil } from './aiStencil.interface';
import { AiStencil } from './aiStencil.model';
import config from '../../config';
import { STENCIL_PROMPTS } from './aiStencil.constant';
import { fileUploader } from '../../utils/fileUploader';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(config.gemini.api_key as string);

const createStencil = async (payload: IAiStencil, file: Express.Multer.File) => {
  try {
    console.log('1. Uploading original to Cloudinary...');
    const uploadedOriginal = await fileUploader.uploadToCloudinary(file);
    payload.originalImage = {
      url: uploadedOriginal.url,
      publicId: uploadedOriginal.public_id,
    };

    // Use Gemini 3.1 Flash-Lite (Most stable in 2026 Free Tier)
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const prompt = `${STENCIL_PROMPTS[payload.style]}. IMPORTANT: Return ONLY the raw Base64 string of the result. No text.`;

    const imagePart = {
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    };

    console.log('2. Requesting AI Generation...');
    // Add a timeout to prevent the service from hanging forever
    const result = (await Promise.race([
      model.generateContent([prompt, imagePart]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI Timeout after 25s')), 25000),
      ),
    ])) as any;

    const response = await result.response;
    const textResponse = response.text();

    // Clean and extract Base64
    const cleanText = textResponse.replace(/```[a-z]*|```/gi, '').trim();
    const base64Regex = /([A-Za-z0-9+/]{100,}=*)/;
    const match = cleanText.match(base64Regex);
    const aiBase64 = match ? match[0] : null;

    if (!aiBase64) throw new Error('AI returned text but no image data.');

    console.log('3. Uploading Stencil to Cloudinary...');
    const uploadedStencil = await fileUploader.uploadBase64ToCloudinary(aiBase64);

    payload.stencilImage = {
      url: uploadedStencil.url,
      publicId: uploadedStencil.public_id,
    };
    payload.status = 'COMPLETED';

    return await AiStencil.create(payload);
  } catch (error: any) {
    console.error('Service Error:', error.message);
    payload.status = 'FAILED';
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
