import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";

import { PublicWwwStack } from "../lib/public-www-stack";

const CACHING_DISABLED_MANAGED_ID = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
/** ALL_VIEWER_EXCEPT_HOST_HEADER */
const ORIGIN_REQUEST_POLICY_ALL_VIEWER_EXCEPT_HOST =
  "b689b0a8-53d0-40ab-baf2-68738e2966ac";

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

function findWwwStarBehavior(
  behaviors: Array<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  return behaviors.find((b) => b.PathPattern === "www/*");
}

function assertEachDistributionWwwBehaviors(template: Template): void {
  const distributions = template.findResources("AWS::CloudFront::Distribution");
  const entries = Object.entries(distributions);
  if (entries.length !== 2) {
    throw new Error(
      `Expected exactly 2 CloudFront distributions (prod + staging), found ${entries.length}`,
    );
  }
  for (const [logicalId, resource] of entries) {
    const behaviors: Array<Record<string, unknown>> =
      resource.Properties?.DistributionConfig?.CacheBehaviors ?? [];
    const freeRequest = behaviors.find(
      (b) => b.PathPattern === "www/v1/assets/free/request",
    );
    if (!freeRequest) {
      throw new Error(
        `Distribution ${logicalId} missing www/v1/assets/free/request behavior`,
      );
    }
    if (freeRequest.CachePolicyId !== CACHING_DISABLED_MANAGED_ID) {
      throw new Error(
        `Distribution ${logicalId}: free/request must use CACHING_DISABLED managed policy`,
      );
    }
    const wwwStar = findWwwStarBehavior(behaviors);
    if (!wwwStar) {
      throw new Error(`Distribution ${logicalId} missing www/* behavior`);
    }
    if (
      typeof wwwStar.CachePolicyId !== "object" ||
      wwwStar.CachePolicyId === null ||
      !("Ref" in wwwStar.CachePolicyId)
    ) {
      throw new Error(
        `Distribution ${logicalId}: www/* must use Ref to custom ApiProxyCachePolicy`,
      );
    }
    const ref = (wwwStar.CachePolicyId as { Ref: string }).Ref;
    if (!/ApiProxyCachePolicy/.test(ref)) {
      throw new Error(
        `Distribution ${logicalId}: unexpected CachePolicyId Ref ${ref}`,
      );
    }
    const methods = wwwStar.AllowedMethods as string[] | undefined;
    if (!methods?.includes("POST") || !methods?.includes("DELETE")) {
      throw new Error(
        `Distribution ${logicalId}: www/* must allow POST/DELETE (ALLOW_ALL)`,
      );
    }
    if (wwwStar.OriginRequestPolicyId !== ORIGIN_REQUEST_POLICY_ALL_VIEWER_EXCEPT_HOST) {
      throw new Error(
        `Distribution ${logicalId}: www/* must use ALL_VIEWER_EXCEPT_HOST_HEADER origin request policy`,
      );
    }
    const fnAssoc = wwwStar.FunctionAssociations as
      | Array<{ EventType?: string; FunctionARN?: unknown }>
      | undefined;
    if (!Array.isArray(fnAssoc) || fnAssoc.length !== 2) {
      throw new Error(
        `Distribution ${logicalId}: www/* must have exactly two FunctionAssociations`,
      );
    }
    const events = new Set(
      fnAssoc.map((a) => a.EventType).filter((e): e is string => typeof e === "string"),
    );
    if (!events.has("viewer-request") || !events.has("viewer-response")) {
      throw new Error(
        `Distribution ${logicalId}: www/* must associate viewer-request and viewer-response functions`,
      );
    }
  }
}

/**
 * Verify CloudFront Function updates are serialized within each environment.
 *
 * The four functions per environment (``PathRewrite``, ``WwwProxyAllowlist``,
 * ``MediaRequestProxy``, ``WwwApiErrorResponse``) must form a single chain via
 * CloudFormation ``DependsOn`` so CloudFormation cannot schedule parallel
 * updates that exhaust the regional CloudFront Functions API rate limit.
 */
function assertCloudFrontFunctionUpdatesAreSerialized(template: Template): void {
  const fns = template.findResources("AWS::CloudFront::Function");
  const entries = Object.entries(fns);
  if (entries.length !== 8) {
    throw new Error(
      `Expected exactly 8 AWS::CloudFront::Function resources (4 per environment x 2), found ${entries.length}`,
    );
  }
  const expectedEnvKinds = [
    "PathRewriteFunction",
    "WwwProxyAllowlistFunction",
    "MediaRequestProxyFunction",
    "WwwApiErrorResponseFunction",
  ] as const;
  for (const envPrefix of ["PublicWww", "PublicWwwStaging"] as const) {
    const ids = expectedEnvKinds.map((kind) => {
      const id = entries.find(([logicalId]) =>
        logicalId.startsWith(`${envPrefix}${kind}`),
      )?.[0];
      if (!id) {
        throw new Error(
          `Missing CloudFront Function ${envPrefix}${kind} in synthesized template`,
        );
      }
      return id;
    });
    const [pathRewriteId, allowlistId, mediaProxyId, errorResponseId] = ids;
    const dependsOn = (logicalId: string): string[] => {
      const raw = fns[logicalId]?.DependsOn;
      if (raw === undefined || raw === null) {
        return [];
      }
      return Array.isArray(raw) ? (raw as string[]) : [raw as string];
    };
    if (!dependsOn(allowlistId).includes(pathRewriteId)) {
      throw new Error(
        `${envPrefix}: WwwProxyAllowlistFunction must DependsOn PathRewriteFunction`,
      );
    }
    if (!dependsOn(mediaProxyId).includes(allowlistId)) {
      throw new Error(
        `${envPrefix}: MediaRequestProxyFunction must DependsOn WwwProxyAllowlistFunction`,
      );
    }
    if (!dependsOn(errorResponseId).includes(mediaProxyId)) {
      throw new Error(
        `${envPrefix}: WwwApiErrorResponseFunction must DependsOn MediaRequestProxyFunction`,
      );
    }
    // Pathrewrite (chain head) must not depend on any sibling function in this
    // environment so the chain stays single-threaded but doesn't deadlock the
    // first item.
    for (const sibling of [allowlistId, mediaProxyId, errorResponseId]) {
      if (dependsOn(pathRewriteId).includes(sibling)) {
        throw new Error(
          `${envPrefix}: PathRewriteFunction must not DependsOn ${sibling}`,
        );
      }
    }
  }
}

function main(): void {
  const template = synthPublicWwwTemplate();
  assertApiProxyCachePolicies(template);
  assertEachDistributionWwwBehaviors(template);
  assertCloudFrontFunctionUpdatesAreSerialized(template);
  // eslint-disable-next-line no-console
  console.log(
    "public-www-stack CloudFront cache policy and function-chain assertions passed.",
  );
}

try {
  main();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
