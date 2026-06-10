const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneRegex = /\b(?:\+\d{1,3}[ -]?)?(?:\(?\d{3}\)?[ -]?|\d{3}[ -]?)\d{3}[ -]?\d{4}\b/g;

export const redactPII = (value: string): string => {
  if (!value) {
    return value;
  }

  return value
    .replace(emailRegex, '[REDACTED]')
    .replace(phoneRegex, '[REDACTED]');
};
