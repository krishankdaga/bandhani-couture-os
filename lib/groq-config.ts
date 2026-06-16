const DEFAULT_MODEL = "llama-3.1-8b-instant";

function cleanEnvValue(value?: string) {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) return trimmed.slice(1, -1).trim();
  return trimmed;
}

export function getGroqConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = cleanEnvValue(env.GROQ_API_KEY);
  const model = cleanEnvValue(env.GROQ_MODEL) || DEFAULT_MODEL;
  return { apiKey, model, exists: apiKey.length > 0, keyLength: apiKey.length };
}

export function safeGroqConfig(env: NodeJS.ProcessEnv = process.env) {
  const config = getGroqConfig(env);
  return { keyExists: config.exists, keyLength: config.keyLength, model: config.model };
}
