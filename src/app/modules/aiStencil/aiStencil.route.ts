import express from 'express';
import { AiStencilController } from './aiStencil.controller';
import { fileUploader } from '../../utils/fileUploader';
import auth from '../../middlewares/auth';

const router = express.Router();

router.post(
  '/create',
  auth(),
  fileUploader.upload.single('file'),
  AiStencilController.createStencil,
);
router.get('/', auth(), AiStencilController.getMyAllStencil);
router.patch('/:id', auth(), AiStencilController.updateStencil);
router.delete('/:id', auth(), AiStencilController.deleteStencil);

export const AiStencilRoutes = router;
