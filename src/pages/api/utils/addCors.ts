import { NextApiResponse } from 'next';
import jwt, { SignOptions } from 'jsonwebtoken';

export default function addCors(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With, Content-Type, Accept',
  );
}

interface generateTokenProps {
  data: object,
  expiration: number, // in hours
}

export function generateToken ( {data, expiration}: generateTokenProps ):string {
 
  const encodedData = jwt.sign({ ...data }, process.env.JWT_AUTH_SECRET, {expiresIn: `${expiration}h`});

  return encodedData;
}
