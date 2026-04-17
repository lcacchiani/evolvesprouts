import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";

import { AdminWebStack } from "../lib/admin-web-stack";

function synthAdminWebTemplate(): Template {
  const app = new cdk.App();
  const stack = new AdminWebStack(app, "TestAdminWeb", {
    env: { account: "111111111111", region: "ap-southeast-1" },
  });
  return Template.fromStack(stack);
}

function assertPathRewriteFunctionExists(template: Template) {
  const functions = template.findResources("AWS::CloudFront::Function");
  const entries = Object.entries(functions);
  const match = entries.find(([, resource]) => {
    const code = resource.Properties?.FunctionCode ?? "";
    return (
      typeof code === "string" &&
      code.includes("index.html") &&
      code.includes("/_next/")
    );
  });
  if (!match) {
    throw new Error(
      "Expected AdminWebStack to define a CloudFront Function that rewrites extensionless paths to /index.html.",
    );
  }
  const [logicalId, resource] = match;
  const runtime = resource.Properties?.FunctionConfig?.Runtime;
  if (runtime !== "cloudfront-js-2.0") {
    throw new Error(
      `Expected admin-web path rewrite function to use runtime cloudfront-js-2.0, found: ${String(runtime)}`,
    );
  }
  return logicalId;
}

function assertDistributionAttachesRewriteFunction(
  template: Template,
  rewriteFunctionLogicalId: string,
) {
  template.hasResourceProperties(
    "AWS::CloudFront::Distribution",
    Match.objectLike({
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: Match.arrayWith([
            Match.objectLike({
              EventType: "viewer-request",
              FunctionARN: {
                "Fn::GetAtt": [rewriteFunctionLogicalId, "FunctionARN"],
              },
            }),
          ]),
        }),
      }),
    }),
  );
}

function assertErrorResponsesPointAt404Page(template: Template) {
  template.hasResourceProperties(
    "AWS::CloudFront::Distribution",
    Match.objectLike({
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 404,
            ResponsePagePath: "/404.html",
            ErrorCachingMinTTL: 60,
          }),
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 404,
            ResponsePagePath: "/404.html",
            ErrorCachingMinTTL: 60,
          }),
        ]),
      }),
    }),
  );
}

function assertNoLegacyIndexHtmlFallback(template: Template) {
  const distributions = template.findResources(
    "AWS::CloudFront::Distribution",
  );
  for (const [logicalId, resource] of Object.entries(distributions)) {
    const errorResponses: Array<{ ResponsePagePath?: string; ResponseCode?: number }> =
      resource.Properties?.DistributionConfig?.CustomErrorResponses ?? [];
    for (const entry of errorResponses) {
      if (
        entry.ResponsePagePath === "/index.html" &&
        entry.ResponseCode === 200
      ) {
        throw new Error(
          `Distribution ${logicalId} still maps an error response to /index.html with status 200. ` +
            "This defeats the new per-route static export and must be removed.",
        );
      }
    }
  }
}

function main() {
  const template = synthAdminWebTemplate();
  const rewriteFunctionLogicalId = assertPathRewriteFunctionExists(template);
  assertDistributionAttachesRewriteFunction(
    template,
    rewriteFunctionLogicalId,
  );
  assertErrorResponsesPointAt404Page(template);
  assertNoLegacyIndexHtmlFallback(template);
  console.log(
    "admin-web-stack CloudFront refresh-routing assertions passed.",
  );
}

try {
  main();
} catch (err) {
  console.error(
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
}
