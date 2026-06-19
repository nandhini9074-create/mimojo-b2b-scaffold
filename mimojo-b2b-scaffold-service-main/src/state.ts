export type ScaffoldStage =
  | 'functions'   // extracted function list + github refs
  | 'diagrams'    // High-Level Architecture, Sequence diagrams, Data Flow Diagram
  | 'docs'        // OpenAPI + project docs
  | 'db'          // PostgreSQL schema
  | 'code'        // generated NodeJS code
  | 'github'      // pushed to GitHub
  | 'done';

export interface GithubRef {
  feature: string;
  repo: string;
  path: string;
  url: string;
  snippet?: string;
}

export interface FeatureInput {
  name: string;
  refs?: string[];
}

export interface PipelineState {
  // Inputs
  projectName: string;
  features: FeatureInput[];

  // Stage outputs
  functions_list?: any;
  github_refs?: GithubRef[];
  repo_tree?: string;  // full directory tree of the reference repo

  diagrams?: string;       // mermaid markdown
  api_docs?: string;       // OpenAPI yaml/json
  project_docs?: string;   // README

  db_schema?: string;      // PostgreSQL DDL

  code_plan?: { files: string[] };
  code_files?: Record<string, string>;

  validation?: {
    passed: boolean;
    errors?: string[];
  };

  repo_url?: string;

  // HITL bookkeeping
  stage: ScaffoldStage;
  history: Array<{ stage: ScaffoldStage; approved: boolean; feedback?: string; at: string }>;
  /** Per-stage last-execution duration in milliseconds. */
  stage_timings?: Partial<Record<ScaffoldStage, number>>;
  /**
   * Cumulative reviewer refinements to the original request, captured from every
   * rejection feedback across all stages. Surfaced to every downstream stage so
   * that modifications made mid-pipeline propagate forward.
   */
  refinements?: Array<{ stage: ScaffoldStage; feedback: string; at: string }>;
}
