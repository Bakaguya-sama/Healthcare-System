import { JwtService } from '@nestjs/jwt';
import { AuthSocket } from '../types/auth-socket.type';

type JwtPayload = {
  sub?: string | number;
};

export async function getUserIdFromSocket(
  jwtService: JwtService,
  socket: AuthSocket,
): Promise<string | null> {
  const authToken =
    typeof socket.handshake.auth?.token === 'string'
      ? socket.handshake.auth.token
      : '';
  const headerAuth =
    typeof socket.handshake.headers?.authorization === 'string'
      ? socket.handshake.headers.authorization
      : '';
  const headerToken = headerAuth ? headerAuth.split(' ')[1] : '';
  const token = authToken || headerToken;

  if (!token) {
    return null;
  }

  try {
    const payload = (await jwtService.verifyAsync(token)) as JwtPayload;
    if (!payload?.sub) {
      return null;
    }

    return String(payload.sub);
  } catch {
    return null;
  }
}
