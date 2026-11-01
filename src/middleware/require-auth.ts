import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const authBaseUrl = process.env.BETTER_AUTH_URL ?? process.env.CLIENT_URL;

if (!authBaseUrl) {
  throw new Error("BETTER_AUTH_URL or CLIENT_URL must be configured.");
}

const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", authBaseUrl));

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authorization = req.get("authorization");
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");

  if (!match) {
    res.status(401).json({
      success: false,
      message: "Sign in is required for this action.",
    });
    return;
  }

  try {
    const { payload } = await jwtVerify(match[1], jwks);

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      res.status(401).json({
        success: false,
        message: "The access token is invalid.",
      });
      return;
    }

    req.authUser = {
      userId: payload.sub,
      name: typeof payload.name === "string" ? payload.name : null,
      email: typeof payload.email === "string" ? payload.email : null,
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error);

    res.status(401).json({
      success: false,
      message: "The access token is invalid or expired.",
    });
  }
};
