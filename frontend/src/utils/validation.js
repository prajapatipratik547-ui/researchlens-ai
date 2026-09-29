// Client-side mirrors of the backend Zod rules, for instant inline feedback.
// The server remains the authority and its field errors are shown too.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (!email.trim()) return 'Email is required';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address';
  return undefined;
}

export function validateLogin({ email, password }) {
  const errors = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = 'Password is required';
  return errors;
}

export function validateRegister({ name, email, password }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  else if (name.trim().length > 80) errors.name = 'Name must be at most 80 characters';

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (new TextEncoder().encode(password).length > 72) {
    errors.password = 'Password must be at most 72 bytes';
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Password must contain a letter and a number';
  }
  return errors;
}
