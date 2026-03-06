import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import router from './app/routes';
import { StripeController } from './app/modules/stripe/stripe.controller';

const app: Application = express();

app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

app.use(cors({ origin: '*', credentials: true }));
app.use(cookieParser());

app.post(
  '/api/v1/stripe/webhook',
  express.raw({ type: 'application/json' }),
  StripeController.handleWebhook,
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/v1', router);

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('<h1>API is running successfully</h1>');
});

// Error Handling
app.use(notFound);
app.use(globalErrorHandler);

export default app;
