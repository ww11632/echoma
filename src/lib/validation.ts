/**
 * Input validation schemas using Zod
 * Protects against XSS, injection attacks, and data corruption
 */

import { z } from "zod";

/**
 * Valid emotion types
 */
export const EMOTION_TYPES = [
  "joy",
  "sadness",
  "anger",
  "anxiety",
  "confusion",
  "peace",
] as const;

/**
 * Emotion snapshot validation schema
 */
export const emotionSnapshotSchema = z.object({
  emotion: z.enum(EMOTION_TYPES, {
    errorMap: () => ({ message: "Invalid emotion type selected" }),
  }),
  intensity: z
    .number()
    .int()
    .min(0, "Intensity must be between 0 and 100")
    .max(100, "Intensity must be between 0 and 100"),
  description: z
    .string()
    .min(1, "Description cannot be empty")
    .max(5000, "Description must be less than 5000 characters")
    .refine(
      (val) => {
        // Basic XSS protection - check for script tags and event handlers
        const dangerousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+\s*=/i,
          /<iframe/i,
          /<object/i,
          /<embed/i,
        ];
        return !dangerousPatterns.some((pattern) => pattern.test(val));
      },
      {
        message: "Description contains potentially unsafe content",
      }
    ),
  timestamp: z.number().int().positive(),
  walletAddress: z
    .string()
    .min(1, "Wallet address is required")
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid wallet address format"),
  version: z.string().default("1.0.0"),
});

/**
 * Blob ID validation schema
 * Walrus blob IDs are typically base64 or hex encoded hashes
 */
export const blobIdSchema = z
  .string()
  .min(32, "Blob ID must be at least 32 characters")
  .max(128, "Blob ID must be at most 128 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Blob ID contains invalid characters"
  );

/**
 * Wallet address validation
 */
export const walletAddressSchema = z
  .string()
  .min(1, "Wallet address is required")
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid Sui wallet address format");

/**
 * Sanitize user input by removing potentially dangerous content
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes and control characters (except newlines and tabs)
  // Use character code filtering to avoid regex control character issues
  let sanitized = input
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      // Allow printable ASCII characters (32-126), newlines (10), and tabs (9)
      return (code >= 32 && code <= 126) || code === 9 || code === 10;
    })
    .join("");
  
  // Normalize whitespace (but preserve newlines)
  sanitized = sanitized
    .replace(/[ \t]+/g, " ") // Collapse spaces and tabs
    .replace(/\n\s+/g, "\n") // Remove leading spaces after newlines
    .replace(/\s+\n/g, "\n") // Remove trailing spaces before newlines
    .trim();
  
  return sanitized;
}

/**
 * Validate and sanitize emotion description
 */
export function validateAndSanitizeDescription(description: string): string {
  const sanitized = sanitizeInput(description);
  
  if (sanitized.length === 0) {
    throw new Error("Description cannot be empty");
  }
  
  if (sanitized.length > 5000) {
    throw new Error("Description must be less than 5000 characters");
  }
  
  return sanitized;
}

