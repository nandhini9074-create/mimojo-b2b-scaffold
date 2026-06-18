/**
 * Defense-in-depth secret scrubber for LangSmith trace payloads.
 *
 * LangChain calls Authorization headers are already excluded by the LangSmith
 * client. This module redacts any *content* string that looks like a secret
 * before it leaves the process — protecting against prompt injection that
 * tries to exfiltrate env vars, accidental logging of process.env, etc.
 */

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "AZURE_KEY", re: /[a-zA-Z0-9]{32,}AAAAACOG[a-zA-Z0-9]+/g }, // Azure OpenAI keys end with AAAAACOG... pattern
  { name: "GITHUB_PAT_CLASSIC", re: /\bghp_[A-Za-z0-9]{30,}\b/g },
  { name: "GITHUB_PAT_FINE", re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g },
  { name: "LANGSMITH_KEY", re: /\blsv2_(pt|sk)_[A-Za-z0-9_]{30,}\b/g },
  { name: "OPENAI_KEY", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "BEARER", re: /Bearer\s+[A-Za-z0-9_\-.=]+/gi },
];

export function redactSecrets(input: string): string {
  if (!input) return input;
  let out = input;
  for (const { name, re } of SECRET_PATTERNS) {
    out = out.replace(re, `[REDACTED:${name}]`);
  }
  // Also redact any literal value of known sensitive env vars
  const envKeys = [
    "AZURE_OPENAI_API_KEY",
    "GITHUB_TOKEN",
    "LANGSMITH_API_KEY",
    "DB_PASSWORD",
  ];
  for (const k of envKeys) {
    const v = process.env[k];
    if (v && v.length >= 8) {
      out = out.split(v).join(`[REDACTED:${k}]`);
    }
  }
  return out;
}
