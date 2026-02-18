import React from 'react';

// Props interface for PIIMasker component
export interface PIIMaskerProps {
  content: string;
  isMasked: boolean;
}

// Regex patterns for PII detection (based on detectors.rs patterns)
const PII_PATTERNS = {
  // Email addresses: user@domain.com
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  
  // Credit card numbers: 13-19 digits with optional separators
  creditCard: /\b(?:\d[ -]*?){13,19}\b/,
  
  // SSN patterns: XXX-XX-XXXX or XXX XX XXXX
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
  
  // Phone numbers: various formats
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/,
  
  // API keys and tokens (common patterns)
  apiKey: /\b(?:api[_-]?key|apikey|api[_-]?secret|api[_-]?token)[=:\s]["']?[a-zA-Z0-9_\-]{16,}["']?/i,
  
  // Bearer tokens
  bearer: /\bBearer\s+[a-zA-Z0-9_\-\.]{20,}\b/i,
  
  // AWS keys
  awsKey: /\b(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/,
  
  // Private keys
  privateKey: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
  
  // Passwords in key-value patterns
  password: /\b(?:password|passwd|pwd|secret)[=:\s]["']?[^\s"']{4,}["']?/i,
  
  // Generic token/secret patterns
  genericSecret: /\b(?:token|secret|auth)[=:\s]["']?[a-zA-Z0-9_\-\.]{16,}["']?/i,
  
  // JWT tokens
  jwt: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b/,
};

// Mask replacement functions
const maskEmail = (match: string): string => {
  const parts = match.split('@');
  if (parts.length !== 2) return '***@***.***';
  const domainParts = parts[1].split('.');
  if (domainParts.length < 2) return '***@***.***';
  return `***@***.${domainParts[domainParts.length - 1]}`;
};

const maskCreditCard = (match: string): string => {
  // Remove any separators and get digits only
  const digits = match.replace(/\D/g, '');
  // Show last 4 digits
  const lastFour = digits.slice(-4);
  return `****-****-****-${lastFour}`;
};

const maskSSN = (): string => {
  return '***-**-****';
};

const maskPhone = (match: string): string => {
  const digits = match.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `(***) ***-${digits.slice(-4)}`;
  }
  return '(***) ***-****';
};

const maskGenericSecret = (match: string): string => {
  // Keep the key name but mask the value
  const parts = match.split(/[=:\s]+/);
  if (parts.length >= 2) {
    const keyName = parts[0];
    return `${keyName}: "***REDACTED***"`;
  }
  return '***REDACTED***';
};

/**
 * Main masking function that applies all PII detection patterns
 */
export const maskPII = (content: string): string => {
  if (!content) return content;
  
  let masked = content;
  
  // Apply each pattern in order
  masked = masked.replace(PII_PATTERNS.email, maskEmail);
  masked = masked.replace(PII_PATTERNS.creditCard, maskCreditCard);
  masked = masked.replace(PII_PATTERNS.ssn, maskSSN);
  masked = masked.replace(PII_PATTERNS.phone, maskPhone);
  masked = masked.replace(PII_PATTERNS.apiKey, maskGenericSecret);
  masked = masked.replace(PII_PATTERNS.bearer, 'Bearer ***REDACTED***');
  masked = masked.replace(PII_PATTERNS.awsKey, 'AKIA****************');
  masked = masked.replace(PII_PATTERNS.privateKey, '-----BEGIN PRIVATE KEY-----\n***REDACTED***\n-----END PRIVATE KEY-----');
  masked = masked.replace(PII_PATTERNS.password, maskGenericSecret);
  masked = masked.replace(PII_PATTERNS.genericSecret, maskGenericSecret);
  masked = masked.replace(PII_PATTERNS.jwt, 'eyJ***.***.***');
  
  return masked;
};

/**
 * PIIMasker Component
 * Toggles masking of sensitive strings in the UI
 */
export const PIIMasker: React.FC<PIIMaskerProps> = ({ content, isMasked }) => {
  const displayContent = isMasked ? maskPII(content) : content;
  
  return (
    <>
      {displayContent}
    </>
  );
};

/**
 * Standalone function to check if content contains PII
 * Useful for showing indicator when PII is detected
 */
export const containsPII = (content: string): boolean => {
  if (!content) return false;
  
  return (
    PII_PATTERNS.email.test(content) ||
    PII_PATTERNS.creditCard.test(content) ||
    PII_PATTERNS.ssn.test(content) ||
    PII_PATTERNS.phone.test(content) ||
    PII_PATTERNS.apiKey.test(content) ||
    PII_PATTERNS.bearer.test(content) ||
    PII_PATTERNS.awsKey.test(content) ||
    PII_PATTERNS.privateKey.test(content) ||
    PII_PATTERNS.password.test(content) ||
    PII_PATTERNS.genericSecret.test(content) ||
    PII_PATTERNS.jwt.test(content)
  );
};

export default PIIMasker;