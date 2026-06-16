// 💡 MODIFICATION: Removed require('dotenv').config() since Docker injects variables directly into system memory!
const { createDocmostPage } = require('./src/services/docmostService');

// Define a structured, clear piece of documentation mock data
const testPayload = {
  title: "YAMI Compliance and Safety Directive Alpha",
  content: `
# Executive Framework Overview
This structural operational brief covers standard emergency handling protocols across internal regional nodes.

## Section 1: Core Systems Guardrails
All operational network bridges must implement robust error recovery sandboxes. Unhandled runtime drops are to be avoided to maintain request-response integrity.

## Section 2: Vector Routing Rules
Data ingestion tracking metrics should be stored natively inside structural application database schemas before attempting downstream transformations via machine learning API models.
  `,
  spaceId: process.env.DOCMOST_DEFAULT_SPACE_ID || null
};

async function executeStandaloneVerificationPipeline() {
  console.log("================================================================");
  console.log("🚀 STARTING BACKEND TO DOCMOST VECTOR INTERACTION INTEGRATION TEST");
  console.log("================================================================");
  console.log(`Target URL Configuration Mapping: ${process.env.DOCMOST_URL || 'http://yami-docmost:3000'}`);
  console.log(`Target DB Injection Mapping:  ${process.env.DOCMOST_DB_URL ? 'CONNECTED (PASS)' : 'MISSING (FAIL)'}`);
  console.log(`Target Space ID Allocation Holder: ${testPayload.spaceId || 'AUTOMATIC FALLBACK'}`);
  console.log("----------------------------------------------------------------\n");

  // 💡 SANITY CHECK: Break early with an informative log if Docker didn't pass the credentials down
  if (!process.env.DOCMOST_DB_URL) {
    console.error("❌ ERROR: process.env.DOCMOST_DB_URL is undefined inside this container context.");
    console.error("Please verify that you have restarted your containers using 'docker compose down && docker compose up -d'.");
    process.exit(1);
  }

  try {
    const outputResult = await createDocmostPage(testPayload);
    
    console.log("\n----------------------------------------------------------------");
    console.log("🎉 VERIFICATION PIPELINE RUN COMPLETE SUCCESSFUL!");
    console.log("----------------------------------------------------------------");
    console.log("Returned DB Schema Object Instance Data Output Structure:\n");
    console.dir(outputResult, { depth: null, colors: true });
    console.log("================================================================");
    
    process.exit(0);
  } catch (executionFailure) {
    console.error("\n================================================================");
    console.error("❌ CRITICAL EXCEPTION INTERCEPTED DURING LIFECYCLE EXECUTION");
    console.error("================================================================");
    console.error(executionFailure.stack || executionFailure.message);
    console.error("================================================================");
    process.exit(1);
  }
}

// Fire execution sequence
executeStandaloneVerificationPipeline();