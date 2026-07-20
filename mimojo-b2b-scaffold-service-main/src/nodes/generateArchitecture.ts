import { o4 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";
import { Logger } from "@nestjs/common";

const logger = new Logger('generateArchitecture');

export async function generateArchitecture(state: PipelineState, feedback?: string) {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    return state.diagrams;
  }

  for (const group of state.template_groups) {
    logger.log(`Generating diagrams for group "${group.id}"...`);
    const started = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
      functions_list: group.output.functions_list,
    };
    group.output.diagrams = await runArchitectureForGroup(groupState, group.id, feedback);
    logger.log(`Diagrams for group "${group.id}" generated in ${Date.now() - started}ms`);
  }

  state.diagrams = state.template_groups[0]?.output.diagrams;

  const elapsed = Date.now() - totalStarted;
  logger.log(`generateArchitecture completed in ${elapsed}ms`);

  return state.diagrams;
}

async function runArchitectureForGroup(state: PipelineState, groupId: string, feedback?: string) {
  const isTx = groupId === 'transaction';

  const flowName = isTx ? 'Transaction / Core Processing' : 'Enrollment / Onboarding';
  const flowListPrompt = `  1. ### ${flowName}`;

  const prompt = `
You are a senior B2B integration architect. Generate THREE architecture artefacts as Mermaid
diagrams for project "${state.projectName}". Output STRICT Markdown — exactly three top-level
sections in this order, each containing one or more \`\`\`mermaid code blocks and NO prose
outside the section headings.

============================================================
GLOBAL ARCHITECTURE & NAMING RULES
============================================================

ARCHITECTURE STYLE
- Prefer layered enterprise integration architecture.
- Use API Gateway -> Integration Layer -> Domain Services -> Data Stores.
- Introduce event brokers only when async/event processing is implied by the functions.
- Prefer clear domain boundaries over excessive microservice decomposition.
- Keep the architecture enterprise-grade, production-ready, and operationally realistic.

SERVICE DERIVATION RULES
- Derive services from the provided function list.
- Group related functions into a single domain service.
- Avoid creating one service per endpoint/function.
- Prefer business capability boundaries:
  - Enrollment functions -> EnrollmentService
  - Payment or transaction functions -> TransactionService
  - Notification or webhook functions -> WebhookService
  - Reporting or reconciliation functions -> ReconciliationService
  - Authentication or identity functions -> AuthService
- Reuse identical service names consistently across ALL diagrams.

NAMING RULES
- Use PascalCase for display names.
- Use camelCase for node IDs and participant aliases.
- Node IDs and participant aliases MUST remain stable across all diagrams.
- Reuse identical IDs, aliases, and service names everywhere.
- Do not invent alternate names for the same component.

OUTPUT DETERMINISM
- Reuse the same node IDs, participant aliases, and service names across all diagrams.
- Prefer fewer, well-grouped services over unnecessary fragmentation.
- Keep naming and topology consistent between:
  - Architecture diagram
  - Sequence diagrams
  - DFD
- If multiple interpretations are possible, prefer the simplest enterprise-valid architecture.

============================================================
SECTION 1 — ## High-Level Architecture Diagram
============================================================
Audience: stakeholders, solution architects, onboarding.
Goal: explain the whole integration in ONE view.
Diagram type: Mermaid \`flowchart LR\` (or \`graph LR\`).

MUST include these node groups (use \`subgraph\` blocks where it improves clarity) and the edges
between them. OMIT a group only if clearly not applicable to the functions below:
  - Partner System(s) / external clients
  - API Gateway / Edge (auth, throttling, WAF)
  - Integration Layer (this project's controllers, adapters, message brokers)
  - Core Services (this project's domain services derived from the function list)
  - Data Stores (PostgreSQL, cache, vault/secret store, object storage)
  - External Dependencies (3rd-party APIs, identity providers, webhooks targets)
  - Security Boundaries — represent with \`subgraph\` titled e.g. "DMZ", "Trusted Zone",
    "Restricted / PCI Zone".

Edge labels MUST state the protocol (HTTPS / gRPC / Kafka / SQL / etc.) and direction.
Use stable node IDs (e.g. \`apiGw\`, \`enrollmentSvc\`) so they can be re-referenced.

============================================================
SECTION 2 — ## Sequence Diagrams
============================================================
Audience: developers and API integration teams.
Goal: explain HOW each flow works step-by-step.
Diagram type: one Mermaid \`sequenceDiagram\` per flow.

Produce a SEPARATE sequence diagram (each in its own \`\`\`mermaid block, prefixed by a \`###\`
sub-heading naming the flow) for EACH of the following flows:
${flowListPrompt}

Each sequence diagram MUST show:
  - Declare participants in left-to-right interaction order before any messages.
  - Participants using \`participant <alias> as <Display Name>\`.
  - Authentication step (token exchange / mTLS / API key validation) at the start.
  - Each request/response with HTTP verb + path or method name.
  - At least one meaningful \`alt\` or \`opt\` block where appropriate for retries,
    validation failures, async handling, or downstream dependency issues.
  - For async flows: use \`-->>\` for async / callback messages and a \`Note over\`
    to mark eventual consistency points.
  - Use consistent aliases and service names across all diagrams.

============================================================
SECTION 3 — ## Data Flow Diagram (DFD)
============================================================
Audience: security, compliance, PCI / DPO reviewers.
Goal: show WHAT sensitive data moves WHERE, and across which trust/encryption boundaries.
Diagram type: Mermaid \`flowchart TD\` with subgraphs for trust zones.

MUST explicitly model:
  - Data classes flowing on each edge — label edges with the data class in brackets, e.g.
    \`-- "[PAN, encrypted]" -->\`. Use these classes when applicable: PII, PAN, CVV, Token,
    Credentials, AuthN-Token, AccessToken, Audit-Event, Public.
  - Encryption boundaries — annotate edges crossing zone borders with \`TLS1.3\`, \`mTLS\`,
    \`AES-256 at rest\`, \`Field-level enc\`, etc.
  - Tokenization / masking points — represent as a node (e.g. \`vault[/"Vault: Tokenize"/]\`)
    and show the transformation (PAN in -> Token out).
  - Storage locations — DB tables, vault, object storage, logs (mark logs as "masked").
  - Regional / edge localization — if the functions hint at multi-region, group nodes in
    subgraphs labelled by region (e.g. \`subgraph EU\`, \`subgraph US\`) and label cross-region
    edges with \`cross-region\`.
  - Trust zones as subgraphs: \`Untrusted\`, \`DMZ\`, \`Trusted\`, \`Restricted_PCI\`.

============================================================
MERMAID SYNTAX RULES — MUST FOLLOW
============================================================

GENERAL
  - Output ONLY plain ASCII inside Mermaid blocks. No smart quotes, em-dashes, or other
    Unicode punctuation. Use a regular hyphen \`-\`, regular quotes \`"\`, and \`->\` arrows.
  - Do NOT use HTML tags except \`<br/>\` for line breaks inside a label.
  - Do NOT use \`\\n\` for newlines inside a label — Mermaid does NOT interpret it. Use
    \`<br/>\` instead.
  - Do NOT put backticks, code fences, or markdown formatting inside a Mermaid block.

FLOWCHART (used by Section 1 and Section 3)
  - Node IDs must be alphanumeric / underscore only. No spaces, no hyphens, no dots.
    Good: \`apiGw\`, \`order_svc\`. Bad: \`api-gw\`, \`order.svc\`.
  - Subgraph IDs MUST be alphanumeric / underscore only. If you want a friendly title with
    spaces or special characters, use the form:
        subgraph trustedZone ["Trusted Zone"]
        ...
        end
    Do NOT write \`subgraph "Trusted Zone"\` or \`subgraph Restricted (PCI / Vault)\` —
    those break the parser. Use \`Restricted_PCI\` as the ID with an optional quoted title.
  - Any node label that contains a space, parenthesis, comma, colon, slash, ampersand,
    quote, or any non-alphanumeric character MUST be wrapped in double quotes INSIDE the
    shape brackets:
        Good: \`partner["Partner System(s)"]\`
        Good: \`vault[("Vault<br/>AES-256 at rest")]\`
        Good: \`logs[("Audit Logs (masked)")]\`
        Bad:  \`partner[Partner System(s)]\`
        Bad:  \`db[(PostgreSQL\\nAES-256 at rest)]\`
        Bad:  \`logs[(Audit Logs (masked))]\`
  - Edge labels with special characters MUST be wrapped in double quotes:
        Good: \`A -- "HTTPS (mTLS)" --> B\`
        Good: \`A -- "[PAN, encrypted; TLS1.3]" --> B\`
        Bad:  \`A -- HTTPS (mTLS) --> B\`
  - Use ONE shape per node. Do not nest shape brackets.

SEQUENCE DIAGRAM (used by Section 2)
  - Allowed control keywords ONLY: \`alt\`, \`else\`, \`opt\`, \`loop\`, \`par\`, \`and\`,
    \`critical\`, \`option\`, \`break\`, and the matching \`end\` closer.
  - \`break\` is ONLY valid as a DIRECT child of a \`loop\` block. NEVER place \`break\`
    inside \`alt\`, \`else\`, or \`opt\`.
  - Do NOT use the keyword \`return\`.
  - Every \`alt\` / \`opt\` / \`loop\` MUST be closed with exactly one matching \`end\`.
  - Participant declaration syntax:
        \`participant <alias> as <Display Name>\`
    The display name must NOT be wrapped in quotes.
        Good: \`participant apiGw as API Gateway\`
        Bad:  \`participant apiGw as "API Gateway"\`
        Bad:  \`participant "API Gateway"\`
  - Use \`->>\` for sync request, \`-->>\` for async / response.
  - Do NOT use \`=>\` or \`<-\`.
  - Notes use exactly:
        \`Note over A,B: message\`
        \`Note right of A: message\`

============================================================
VALIDATION RULES
============================================================
- Ensure all Mermaid blocks are syntactically valid.
- Ensure every \`subgraph\` has a matching \`end\`.
- Ensure every \`alt\`, \`opt\`, and \`loop\` block has a matching \`end\`.
- Do not use unsupported Mermaid syntax.
- Do not emit prose inside Mermaid blocks.
- Ensure all diagrams are internally consistent.
- Ensure IDs, aliases, and service names match across all diagrams.
- Ensure no \`\\n\` appears anywhere inside Mermaid blocks.
- Ensure all labels containing spaces or special characters are quoted correctly.
- Ensure all node IDs and subgraph IDs are alphanumeric or underscore only.

============================================================
INPUT CONTEXT
============================================================

Functions (derive services, flows and data classes from this):
${JSON.stringify(state.functions_list, null, 2)}

Existing GitHub references (reuse component names / patterns where they fit):
${JSON.stringify(state.github_refs ?? [], null, 2)}

CRITICAL INSTRUCTION: You MUST strictly mirror the exact structural components, service layers, and data models found in the GitHub references.

${feedback ? `Reviewer feedback to incorporate (highest priority):\n${feedback}` : ""}
${renderRefinements(state)}

============================================================
OUTPUT RULES (STRICT)
============================================================
- Return Markdown ONLY.
- The three top-level headings MUST be exactly:
    ## High-Level Architecture Diagram
    ## Sequence Diagrams
    ## Data Flow Diagram (DFD)
- Every diagram MUST be inside a \`\`\`mermaid fenced code block and MUST be syntactically
  valid Mermaid per the rules above.
- Do NOT include any other sections, prose intros, or trailing explanations.
`;

  const res = await o4.invoke(prompt);
  return res.content as string;
}
