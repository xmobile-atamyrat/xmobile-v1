import addCors from '@/pages/api/utils/addCors';
import { generateToken, verifyToken } from '@/pages/api/utils/tokenUtils';
import {
  ACCESS_TOKEN_EXPIRY,
  AUTH_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/auth.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<string>>,
) {
  addCors(res);
  const { method } = req;
  const cookies = req.headers.cookie;

  if (method === 'GET') {
    try {
      const refreshToken = cookies
        .split('; ')
        .find((row) => row.startsWith(`${AUTH_REFRESH_COOKIE_NAME}=`))
        ?.split('=')[1];

      const verifiedTokenData = verifyToken(
        refreshToken,
        process.env.NEXT_PUBLIC_JWT_AUTH_SECRET,
      );

      const newRefreshToken = generateToken(
        verifiedTokenData,
        process.env.NEXT_PUBLIC_JWT_AUTH_SECRET,
        REFRESH_TOKEN_EXPIRY,
      );

      const accessToken = generateToken(
        verifiedTokenData,
        process.env.NEXT_PUBLIC_JWT_AUTH_SECRET,
        ACCESS_TOKEN_EXPIRY,
      );

      res.setHeader(
        'Set-Cookie',
        `${AUTH_REFRESH_COOKIE_NAME}=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
      );

      return res.status(200).json({ success: true, data: accessToken });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        console.error(filepath, ' Invalid Refresh Token; ', error);
        return res
          .status(401)
          .json({ success: false, message: 'Refresh token expired' });
      }
      console.error(filepath, "Couldn't authenticate user. ", error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't authenticate user" });
    }
  } else {
    return res
      .status(405)
      .json({ success: false, message: 'Method Not Allowed' });
  }
}
