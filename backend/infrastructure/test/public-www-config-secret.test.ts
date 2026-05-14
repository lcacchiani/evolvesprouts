import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

import { ApiStack } from "../lib/api-stack";

/**
 * Guards the JSON encoding of the PublicWwwConfig secret.
 *
 * `secretObjectValue` and naked `cdk.Fn.toJsonString` on a plain JS object
 * both fall back to `Fn::Join`, which substitutes CFN parameter values
 * verbatim with no JSON escaping. That breaks any value containing
 * newlines (`PUBLIC_WWW_BUSINESS_ADDRESS`), double quotes, or backslashes:
 * the resulting SecretString is invalid JSON, `json.loads` in
 * `app.config.public_www` fails, and every PUBLIC_WWW_* lookup silently
 * falls back to defaults — the symptom that broke the AR invoice PDF when
 * this stack was first deployed.
 *
 * The fix is to wrap the payload in `cdk.Lazy.any({...})` so CDK emits a
 * real `Fn::ToJsonString` intrinsic (enabled by the `AWS::LanguageExtensions`
 * transform on the stack), which CloudFormation evaluates server-side
 * with proper JSON escaping for embedded newlines / quotes / backslashes.
 *
 * This test asserts both invariants so a regression cannot reach
 * production unnoticed.
 */
function synth(): Template {
  const app = new cdk.App();
  const stack = new ApiStack(app, "TestApi", {
    env: { account: "111111111111", region: "ap-southeast-1" },
  });
  return Template.fromStack(stack);
}

const template = synth();
const stackJson = template.toJSON() as Record<string, unknown>;
const transform = stackJson.Transform;
const transforms = Array.isArray(transform) ? transform : [transform];
if (!transforms.includes("AWS::LanguageExtensions")) {
  throw new Error(
    `ApiStack must declare the AWS::LanguageExtensions transform so ` +
      `Fn::ToJsonString resolves at deploy time; got ${JSON.stringify(transform)}`,
  );
}

const secrets = template.findResources("AWS::SecretsManager::Secret", {
  Properties: { Name: "evolvesprouts-public-www-config" },
});
const entries = Object.entries(secrets);
if (entries.length !== 1) {
  throw new Error(
    `Expected exactly 1 evolvesprouts-public-www-config secret; found ${entries.length}`,
  );
}
const [, resource] = entries[0];
const secretString = (
  resource.Properties as { SecretString?: unknown }
).SecretString;
const looksLikeFnToJsonString =
  secretString !== null &&
  typeof secretString === "object" &&
  Object.prototype.hasOwnProperty.call(secretString, "Fn::ToJsonString");
if (!looksLikeFnToJsonString) {
  throw new Error(
    "PublicWwwConfigSecret must use Fn::ToJsonString so multi-line / " +
      "quote-bearing CFN parameter values produce valid JSON. " +
      `Got: ${JSON.stringify(secretString)}`,
  );
}
console.log(
  "PublicWwwConfigSecret JSON-encoding assertions passed (Fn::ToJsonString + transform).",
);
