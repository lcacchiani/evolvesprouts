import * as cdk from "aws-cdk-lib";

/**
 * IAM resource ARNs for SES SendEmail. When the domain is verified in SES,
 * authorization may be evaluated against `identity/<domain>` even if the From
 * address is a specific mailbox — include both the address and domain ARNs.
 */
export function sesVerifiedAddressAndDomainIdentityArns(
  stack: cdk.Stack,
  verifiedFromEmailAddress: string
): [string, string] {
  const domainPart = cdk.Fn.select(1, cdk.Fn.split("@", verifiedFromEmailAddress));
  const addressArn = stack.formatArn({
    service: "ses",
    resource: "identity",
    resourceName: verifiedFromEmailAddress,
  });
  const domainArn = stack.formatArn({
    service: "ses",
    resource: "identity",
    resourceName: domainPart,
  });
  return [addressArn, domainArn];
}
