export const userResponse = (user: any) => {
  const { _id, name, email } = user;
  return { _id, name, email };
};
