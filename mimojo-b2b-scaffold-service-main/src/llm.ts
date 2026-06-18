import { AzureChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { redactSecrets } from "./common/security/redact";

// Build the basePath the SDK expects: <endpoint>/openai/deployments
// Works for both *.openai.azure.com and *.cognitiveservices.azure.com (Azure AI Foundry)
const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
const BASE_PATH = `${ENDPOINT}/openai/deployments`;

// Azure GPT-4.1 — used for: extractFunctions, generateDbSchema, generateCodePlan, generateModuleCode, fix
const _gpt41 = new AzureChatOpenAI({
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureOpenAIBasePath: BASE_PATH,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_GPT41!,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION!,
  temperature: 0.2,
  modelName: "gpt-4.1",
});

// Azure O4 — used for: generateArchitecture (diagrams), generateDocs (documents)
const _o4 = new AzureChatOpenAI({
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureOpenAIBasePath: BASE_PATH,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_O4!,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION!,
  temperature: 1,
  modelName: "o4",
});

/**
 * Wrap an AzureChatOpenAI so every string prompt is redacted before
 * being sent to Azure (and therefore before it lands in LangSmith).
 */
function withRedaction(model: AzureChatOpenAI) {
  return {
    async invoke(prompt: string) {
      const safe = redactSecrets(prompt);
      return model.invoke(safe);
    },
  };
}

export const gpt41 = withRedaction(_gpt41);
export const o4 = withRedaction(_o4);
