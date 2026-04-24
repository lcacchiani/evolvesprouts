import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";

import { PublicWwwStack } from "../lib/public-www-stack";

const CACHING_DISABLED_MANAGED_ID = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";

function synthPublicWwwTemplate(): Template {
  const app = new cdk.App();
  const stack = new PublicWwwStack(app, "TestPublicWww", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  return Template.fromStack(stack);
}

function assertApiProxyCachePolicies(template: Template): void {
  const policies = template.findResources("AWS::CloudFront::CachePolicy");
  const entries = Object.entries(policies);
  if (entries.length !== 2) {
    throw new Error(
      `Expected exactly 2 AWS::CloudFront::CachePolicy resources (prod + staging), found ${entries.length}`,
    );
  }
  for (const [, resource] of entries) {
    const config = resource.Properties?.CachePolicyConfig;
    if (!config) {
      throw new Error("Cache policy missing CachePolicyConfig");
    }
    if (config.DefaultTTL !== 300 || config.MaxTTL !== 900 || config.MinTTL !== 0) {
      throw new Error(
        `Unexpected TTLs on cache policy: ${JSON.stringify({
          DefaultTTL: config.DefaultTTL,
          MaxTTL: config.MaxTTL,
          MinTTL: config.MinTTL,
        })}`,
      );
    }
    const params = config.ParametersInCacheKeyAndForwardedToOrigin;
    if (params?.QueryStringsConfig?.QueryStringBehavior !== "all") {
      throw new Error("Expected QueryStringBehavior=all on API proxy cache policy");
    }
    if (params?.HeadersConfig?.HeaderBehavior !== "none") {
      throw new Error("Expected HeaderBehavior=none on API proxy cache policy");
    }
    if (params?.CookiesConfig?.CookieBehavior !== "none") {
      throw new Error("Expected CookieBehavior=none on API proxy cache policy");
    }
    if (params?.EnableAcceptEncodingGzip !== true) {
      throw new Error("Expected EnableAcceptEncodingGzip=true");
    }
    if (params?.EnableAcceptEncodingBrotli !== true) {
      throw new Error("Expected EnableAcceptEncodingBrotli=true");
    }
  }
}

function assertWwwBehaviors(template: Template): void {
  template.hasResourceProperties(
    "AWS::CloudFront::Distribution",
    Match.objectLike({
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: "www/v1/assets/free/request",
            CachePolicyId: CACHING_DISABLED_MANAGED_ID,
            AllowedMethods: Match.arrayWith(["POST", "DELETE"]),
          }),
          Match.objectLike({
            PathPattern: "www/*",
            AllowedMethods: Match.arrayWith(["POST", "DELETE"]),
            CachePolicyId: { Ref: Match.stringLikeRegexp("ApiProxyCachePolicy") },
          }),
        ]),
      }),
    }),
  );
}

function main(): void {
  const template = synthPublicWwwTemplate();
  assertApiProxyCachePolicies(template);
  assertWwwBehaviors(template);
  // eslint-disable-next-line no-console
  console.log("public-www-stack CloudFront cache policy assertions passed.");
}

try {
  main();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
