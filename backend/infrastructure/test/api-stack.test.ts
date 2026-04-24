import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

import { ApiStack } from "../lib/api-stack";

function synthApiTemplate(): Template {
  const app = new cdk.App();
  const stack = new ApiStack(app, "TestApi", {
    env: { account: "111111111111", region: "ap-southeast-1" },
  });
  return Template.fromStack(stack);
}

function assertStageHasNoApiGatewayCacheCluster(template: Template): void {
  const stages = template.findResources("AWS::ApiGateway::Stage");
  const entries = Object.entries(stages);
  if (entries.length === 0) {
    throw new Error("Expected at least one AWS::ApiGateway::Stage resource");
  }
  for (const [logicalId, resource] of entries) {
    const props = resource.Properties ?? {};
    if (props.CacheClusterEnabled === true) {
      throw new Error(
        `Stage ${logicalId} has CacheClusterEnabled=true; expected no cache cluster`,
      );
    }
    if ("CacheClusterSize" in props) {
      throw new Error(
        `Stage ${logicalId} must not set CacheClusterSize when cache cluster is disabled`,
      );
    }
    if ("CacheDataEncrypted" in props) {
      throw new Error(
        `Stage ${logicalId} must not set CacheDataEncrypted when cache cluster is disabled`,
      );
    }
    const methodSettings: unknown[] = props.MethodSettings ?? [];
    for (const entry of methodSettings) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const ms = entry as Record<string, unknown>;
      if ("CachingEnabled" in ms) {
        throw new Error(
          `Stage ${logicalId} MethodSettings must not include CachingEnabled overrides; found ${JSON.stringify(ms)}`,
        );
      }
      if ("CacheTtlInSeconds" in ms) {
        throw new Error(
          `Stage ${logicalId} MethodSettings must not include CacheTtlInSeconds; found ${JSON.stringify(ms)}`,
        );
      }
    }
  }
}

function main(): void {
  const template = synthApiTemplate();
  assertStageHasNoApiGatewayCacheCluster(template);
  // eslint-disable-next-line no-console
  console.log("api-stack API Gateway stage cache assertions passed.");
}

try {
  main();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
