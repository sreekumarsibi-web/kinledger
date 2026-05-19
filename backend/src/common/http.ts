import { BadRequestException } from "@nestjs/common";
import { z, ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.flatten());
  }
  return parsed.data;
}

export const uuidSchema = z.string().uuid();

export type AuthUser = {
  firebaseUid: string;
  email?: string;
  phone?: string;
  name?: string;
};
