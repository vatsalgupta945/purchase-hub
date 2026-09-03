import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, AuthenticationError } from '../errors/AppError';

export const requireRole = (allowedRole: 'requester' | 'approver') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError());
    }

    if (req.user.role !== allowedRole) {
      return next(new ForbiddenError(`Only users with role '${allowedRole}' can perform this action`));
    }

    next();
  };
};
