/**
 * Token provider function type
 * Returns the access token or null if not available
 */
export type TokenProvider = () => string | null | Promise<string | null>;
