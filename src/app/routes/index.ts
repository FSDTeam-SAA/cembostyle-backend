import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';
import { UserRoutes } from '../modules/user/user.route';
import { PreGalleryRoutes } from '../modules/preGallery/preGallery.route';
import { AiStencilRoutes } from '../modules/aiStencil/aiStencil.route';
import { StripeRoutes } from '../modules/stripe/stripe.route';
import { PaymentRoutes } from '../modules/payment/payment.route';
import { DashboardRoutes } from '../modules/dashboard/dashboard.route';

const router = Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/user',
    route: UserRoutes,
  },
  {
    path: '/pregallery',
    route: PreGalleryRoutes,
  },
  {
    path: '/aistencil',
    route: AiStencilRoutes,
  },
  {
    path: '/stripe',
    route: StripeRoutes,
  },
  {
    path: '/payment',
    route: PaymentRoutes,
  },
  {
    path: '/dashboard',
    route: DashboardRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
