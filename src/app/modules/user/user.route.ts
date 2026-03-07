import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from './user.constant';
import { UserControllers } from './user.controller';
import { fileUploader } from '../../utils/fileUploader';

const router = express.Router();

router.get('/me', auth(USER_ROLE.USER, USER_ROLE.ADMIN), UserControllers.getProfile);
router.patch(
  '/update-profile',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  fileUploader.upload.single('file'),
  UserControllers.updateProfile,
);
router.get('/', auth(USER_ROLE.ADMIN), UserControllers.getAllUsers);
router.get('/premium', auth(USER_ROLE.ADMIN), UserControllers.getPremiumUsers);
router.get('/free', auth(USER_ROLE.ADMIN), UserControllers.getFreeUsers);
router.get('/:id', auth(USER_ROLE.ADMIN), UserControllers.getSingleUser);
router.delete('/:id', auth(USER_ROLE.ADMIN), UserControllers.deleteUser);
router.patch('/block-user/:userId', auth(USER_ROLE.ADMIN), UserControllers.blockUser);
router.patch('/update-premium', auth(USER_ROLE.ADMIN), UserControllers.updatePremiumStatus);

export const UserRoutes = router;
