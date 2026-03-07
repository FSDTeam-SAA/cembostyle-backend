import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import { DashboardControllers } from './dashboard.controller';

const router = express.Router();

router.get('/stats', auth(USER_ROLE.ADMIN), DashboardControllers.getDashboardStats);

export const DashboardRoutes = router;
