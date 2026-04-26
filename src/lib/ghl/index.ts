// Barrel — single import path for every GHL primitive.
//
//   import { getGhlClient, upsertContact, createOpportunity,
//            triggerWorkflow, sendEmailMessage } from "@/lib/ghl";
//
// All exports are server-only. Importing this file from a client
// component will fail at build time (`server-only` guard in client.ts).

export * from "./client";
export * from "./contacts";
export * from "./opportunities";
export * from "./messages";
export * from "./workflows";
export * from "./pipelineSync";
