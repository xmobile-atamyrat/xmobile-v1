import jwt from 'jsonwebtoken';
import { JwtExpiration, JwtPayloadData } from '@/pages/lib/types';

// use functions in try-catch
export function generateToken(
  data: object | string,
  secret: string,
  expiration: JwtExpiration,
): string {
  const encodedData = jwt.sign({ data }, secret, {
    expiresIn: expiration,
  });

  return encodedData;
}

export const verifyToken = (token: string, secret: string) => {
  const decodedToken = jwt.verify(token, secret);

  return (decodedToken as JwtPayloadData).data;
};
