import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-not-secret-change-me'

export interface Claims { sub: number; email: string; role: string }

export function signToken(payload: Claims): string {
  return jwt.sign(payload, SECRET, { expiresIn: '2h' })
}

export function verifyToken(token: string): Claims {
  return jwt.verify(token, SECRET) as unknown as Claims
}
