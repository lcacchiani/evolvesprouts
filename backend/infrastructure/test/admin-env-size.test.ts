import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { ApiStack } from "../lib/api-stack";

/**
 * Asserts the admin Lambda's environment-variable dict (with CDK tokens
 * resolved to their CloudFormation expressions) stays well under AWS's
 * 4096-byte cap. This guards against future env-var creep that would
 * regress the deploy fix introduced for the admin Lambda 4 KB overage.
 */
function synthAdminEnvBytes(): number {
  const app = new cdk.App();
  const stack = new ApiStack(app, "TestApi", {
    env: { account: "111111111111", region: "ap-southeast-1" },
  });
  const template = Template.fromStack(stack);
  const fns = template.findResources("AWS::Lambda::Function", {
    Properties: {
      FunctionName: Match.stringLikeRegexp("evolvesprouts-Evolvesprouts.*Admin.*"),
    },
  });
  const entries = Object.entries(fns);
  if (entries.length !== 1) {
    throw new Error(
      `Expected exactly 1 admin Lambda; found ${entries.length}: ${entries
        .map(([id]) => id)
        .join(", ")}`,
    );
  }
  const [, resource] = entries[0];
  const env = (resource.Properties as { Environment?: { Variables?: unknown } })
    .Environment?.Variables;
  if (!env) {
    throw new Error("Admin Lambda has no Environment.Variables");
  }
  // Token-resolved CloudFormation expressions (Refs, Fn::Joins) collapse
  // to short placeholders in the synthesised template; we approximate the
  // real env-var dict size by counting the JSON.stringify length, which
  // is what AWS also measures (post-token-resolution at deploy time).
  return JSON.stringify(env).length;
}

const bytes = synthAdminEnvBytes();
// AWS measures the resolved env-var dict against a 4096-byte hard limit at
// deploy time. Synth-form values include CDK tokens / CloudFormation Ref
// expressions, so this number is directional rather than exact, but a
// generous soft cap keeps obvious regressions out of main.
const SOFT_LIMIT = 3800;
if (bytes >= SOFT_LIMIT) {
  throw new Error(
    `Admin Lambda env-var JSON is ${bytes} bytes (synth form); soft limit ` +
      `is ${SOFT_LIMIT} (AWS hard limit is 4096 at deploy time). Move ` +
      "additional config into PublicWwwConfigSecret or a similar secret.",
  );
}
console.log(
  `admin env-var size assertion passed (${bytes} < ${SOFT_LIMIT} bytes).`,
);
