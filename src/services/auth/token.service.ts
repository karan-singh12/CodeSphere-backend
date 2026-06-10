import jwt from "jsonwebtoken";

export class TokenService {
  static generateAccessToken(
    userId: string,
    secret: string,
    expiresIn: string,
    email?: string
  ): { token: string } {
    const payload = email ? { userId, email } : { userId };
    const token = jwt.sign(payload, secret, { expiresIn: expiresIn as any });
    return { token };
  }
}
