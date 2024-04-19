// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { dbClient } from "@/lib/dbClient";
import { User } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseApi } from "@/pages/lib/types";

type Data = {
  name: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
): Promise<ResponseApi | void> {
  switch (req.method) {
    case "POST":
      try {
        const { email, name, password, phoneNumber }: User = req.body;
        const user = await dbClient.user.create({
          data: {
            email,
            name,
            password,
            phoneNumber,
          },
        });
        // return res.status(200).json({
        //   // success: true,
        //   data: user,
        // });
      } catch (error) {
        return {
          success: false,
          message: "",
        };
      }
  }
  return res.status(200).json({ name: "John Doe" });
}
