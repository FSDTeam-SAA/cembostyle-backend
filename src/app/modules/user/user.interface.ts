import { USER_ROLE } from './user.constant';

export type TUserRole = keyof typeof USER_ROLE;

export interface IUser {
  name: string;
  email: string;
  password?: string | undefined;
  role: TUserRole;
  profileImage?: {
    url: string;
    publicId: string;
  };
  otp?: string | undefined;
  otpExpires?: Date | undefined;

  // Stripe Subscription Fields
  isPremium: boolean;
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'incomplete';
}
