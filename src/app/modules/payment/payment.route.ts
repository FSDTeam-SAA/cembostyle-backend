import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import { PaymentControllers } from './payment.controller';

const router = express.Router();

router.get('/total-amount', auth(USER_ROLE.ADMIN), PaymentControllers.getTotalPaymentAmount);
router.get('/stats', auth(USER_ROLE.ADMIN), PaymentControllers.getPaymentsStats);

export const PaymentRoutes = router;
