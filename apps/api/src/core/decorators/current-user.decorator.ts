import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return undefined;
    const normalizedUser =
      typeof user === 'object'
        ? { ...user, id: user.id ?? user.sub, sub: user.sub ?? user.id }
        : user;
    return data ? normalizedUser?.[data] : normalizedUser;
  },
);
