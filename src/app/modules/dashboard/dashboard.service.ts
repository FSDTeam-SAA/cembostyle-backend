import { User } from '../user/user.model';

const getDashboardStats = async () => {
  const result = await User.aggregate([
    {
      $facet: {
        totalUsers: [{ $match: { role: 'USER' } }, { $count: 'count' }],
        freeTrialUsers: [{ $match: { role: 'USER', isPremium: false } }, { $count: 'count' }],
        premiumUsers: [{ $match: { role: 'USER', isPremium: true } }, { $count: 'count' }],
      },
    },
  ]);

  return {
    totalUsers: result[0].totalUsers[0]?.count || 0,
    totalFreeTrialUsers: result[0].freeTrialUsers[0]?.count || 0,
    totalPremiumUsers: result[0].premiumUsers[0]?.count || 0,
  };
};

export const DashboardServices = { getDashboardStats };
