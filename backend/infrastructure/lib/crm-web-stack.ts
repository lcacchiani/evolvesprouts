import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class CrmWebStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly loggingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Organization", "Evolve Sprouts");
    cdk.Tags.of(this).add("Project", "CRM Website");

    const resourcePrefix = "evolvesprouts";
    const name = (suffix: string) => `${resourcePrefix}-${suffix}`;

    const domainName = new cdk.CfnParameter(this, "CrmWebDomainName", {
      type: "String",
      description: "Custom domain for CRM web (CloudFront alias).",
    });

    const certificateArn = new cdk.CfnParameter(this, "CrmWebCertificateArn", {
      type: "String",
      description: "ACM certificate ARN for CRM web domain.",
    });

    const wafWebAclArn = new cdk.CfnParameter(this, "WafWebAclArn", {
      type: "String",
      description:
        "WAF WebACL ARN for CloudFront protection (must be from us-east-1).",
      allowedPattern: "^arn:aws:wafv2:us-east-1:[0-9]+:global/webacl/.+$",
      constraintDescription: "Must be a valid WAF WebACL ARN from us-east-1.",
    });

    const loggingBucketName = [
      name("crm-web-logs"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    this.loggingBucket = new s3.Bucket(this, "CrmWebLoggingBucket", {
      bucketName: loggingBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "ExpireOldLogs",
          enabled: true,
          expiration: cdk.Duration.days(90),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const loggingBucketCfn = this.loggingBucket.node.defaultChild as s3.CfnBucket;
    loggingBucketCfn.addMetadata("checkov", {
      skip: [
        {
          id: "CKV_AWS_18",
          comment:
            "Logging bucket cannot have self-logging without recursion.",
        },
      ],
    });

    const bucketName = [
      name("crm-web"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    this.bucket = new s3.Bucket(this, "CrmWebBucket", {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsBucket: this.loggingBucket,
      serverAccessLogsPrefix: "s3-access-logs/",
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "CrmWebOai",
      {
        comment: "OAI for CRM web CloudFront distribution.",
      },
    );
    this.bucket.grantRead(originAccessIdentity);

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "CrmWebCertificate",
      certificateArn.valueAsString,
    );

    const origin = origins.S3BucketOrigin.withOriginAccessIdentity(this.bucket, {
      originAccessIdentity,
    });

    this.distribution = new cloudfront.Distribution(this, "CrmWebDistribution", {
      defaultRootObject: "index.html",
      domainNames: [domainName.valueAsString],
      certificate,
      webAclId: wafWebAclArn.valueAsString,
      enableLogging: true,
      logBucket: this.loggingBucket,
      logFilePrefix: "cloudfront-access-logs/",
      logIncludesCookies: false,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // CRM is intentionally a shell SPA.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    new cdk.CfnOutput(this, "CrmWebBucketName", {
      value: this.bucket.bucketName,
    });

    new cdk.CfnOutput(this, "CrmWebDistributionId", {
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, "CrmWebDistributionDomain", {
      value: this.distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "CrmWebLoggingBucketName", {
      value: this.loggingBucket.bucketName,
      description: "S3 bucket for CloudFront and S3 access logs",
    });
  }
}
