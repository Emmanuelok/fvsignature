// The organizer uses the original wedding Site's private ChatGPT sign-in.
// This flag is independent of anonymous guest submissions and contains no secret.
export const WEDDING_ORGANIZER_BACKEND_ENABLED = true;

// Enable only after the backend's public submission routes have been deployed,
// owner enrollment has been disabled, and its audience change has been approved.
export const WEDDING_GUEST_BACKEND_ENABLED = false;
