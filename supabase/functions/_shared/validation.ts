/**
 * Input validation schemas for Supabase Edge Functions
 * Uses Zod for comprehensive type checking and validation
 * Protects against XSS, injection attacks, and data corruption
 */

import { z } from 'https://esm.sh/zod@3.22.4';

/**
 * Valid emotion types (must match frontend)
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
 * Encrypted data structure validation
 * encryptedData should be a JSON string containing ciphertext, iv, and salt
 */
const encryptedDataSchema = z.object({
  ciphertext: z.string().min(1, "Ciphertext cannot be empty"),
  iv: z.string().min(1, "IV cannot be empty"),
  salt: z.string().min(1, "Salt cannot be empty"),
});

/**
 * Upload emotion request validation schema
 * Validates all inputs from the client before processing
 */
export const uploadEmotionRequestSchema = z.object({
  emotion: z.enum(EMOTION_TYPES, {
    errorMap: () => ({ message: "Invalid emotion type. Must be one of: joy, sadness, anger, anxiety, confusion, peace" }),
  }),
  intensity: z
    .number({
      required_error: "Intensity is required",
      invalid_type_error: "Intensity must be a number",
    })
    .int("Intensity must be an integer")
    .min(0, "Intensity must be between 0 and 100")
    .max(100, "Intensity must be between 0 and 100"),
  description: z
    .string({
      required_error: "Description is required",
      invalid_type_error: "Description must be a string",
    })
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
        message: "Description contains potentially unsafe content (XSS attempt detected)",
      }
    ),
  encryptedData: z
    .string({
      required_error: "Encrypted data is required",
      invalid_type_error: "Encrypted data must be a string",
    })
    .min(1, "Encrypted data cannot be empty")
    .refine(
      (val) => {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(val);
          // Validate the structure matches encrypted data format
          encryptedDataSchema.parse(parsed);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Encrypted data must be valid JSON with ciphertext, iv, and salt fields",
      }
    ),
  isPublic: z
    .boolean({
      invalid_type_error: "isPublic must be a boolean",
    })
    .optional()
    .default(false),
});

/**
 * Type for validated upload emotion request
 */
export type UploadEmotionRequest = z.infer<typeof uploadEmotionRequestSchema>;

