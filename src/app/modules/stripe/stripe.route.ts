import express from 'express';
import auth from '../../middlewares/auth';
import { StripeController } from './stripe.controller';

const router = express.Router();

router.post('/create-payment-session', auth(), StripeController.createPaymentSession);

export const StripeRoutes = router;
