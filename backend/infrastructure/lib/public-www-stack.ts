import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface PublicWwwStackProps extends cdk.StackProps {
  readonly environmentName: "production" | "staging";
  readonly domainParameterName: string;
  readonly certificateParameterName: string;
  readonly bucketNamePrefix: string;
  readonly loggingBucketNamePrefix: string;
  readonly applyNoIndexResponseHeader?: boolean;
}

export class PublicWwwStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly loggingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: PublicWwwStackProps) {
    super(scope, id, props);

    const isStaging = props.environmentName === "staging";

    cdk.Tags.of(this).add("Organization", "Evolve Sprouts");
    cdk.Tags.of(this).add("Project", "Public Website");
    cdk.Tags.of(this).add("Environment", props.environmentName);

    const domainName = new cdk.CfnParameter(this, props.domainParameterName, {
      type: "String",
      description: isStaging
        ? "Custom domain for staging public website (CloudFront alias)."
        : "Custom domain for production public website (CloudFront alias).",
    });

    const certificateArn = new cdk.CfnParameter(
      this,
      props.certificateParameterName,
      {
        type: "String",
        description: isStaging
          ? "ACM certificate ARN for staging public website domain."
          : "ACM certificate ARN for production public website domain.",
      },
    );

    const wafWebAclArn = new cdk.CfnParameter(this, "WafWebAclArn", {
      type: "String",
      default: "",
      description:
        "WAF WebACL ARN for CloudFront protection (must be from us-east-1).",
      allowedPattern: "^$|arn:aws:wafv2:us-east-1:[0-9]+:global/webacl/.+$",
      constraintDescription:
        "Must be empty or a valid WAF WebACL ARN from us-east-1.",
    });
    const hasWafWebAclArn = new cdk.CfnCondition(this, "HasWafWebAclArn", {
      expression: cdk.Fn.conditionNot(
        cdk.Fn.conditionEquals(wafWebAclArn.valueAsString, ""),
      ),
    });

    const loggingBucketName = [
      props.loggingBucketNamePrefix,
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    this.loggingBucket = new s3.Bucket(this, "PublicWwwLoggingBucket", {
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

    const noIndexResponseHeadersPolicy = props.applyNoIndexResponseHeader
      ? new cloudfront.ResponseHeadersPolicy(
          this,
          "PublicWwwNoIndexResponseHeadersPolicy",
          {
            comment:
              "Prevent indexing for staging public website distribution.",
            customHeadersBehavior: {
              customHeaders: [
                {
                  header: "X-Robots-Tag",
                  value: "noindex, nofollow, noarchive",
                  override: true,
                },
              ],
            },
          },
        )
      : undefined;

    const bucketName = [
      props.bucketNamePrefix,
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    this.bucket = new s3.Bucket(this, "PublicWwwBucket", {
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
      "PublicWwwOai",
      {
        comment: "OAI for public website CloudFront distribution.",
      },
    );
    this.bucket.grantRead(originAccessIdentity);

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "PublicWwwCertificate",
      certificateArn.valueAsString,
    );

    const origin = origins.S3BucketOrigin.withOriginAccessIdentity(this.bucket, {
      originAccessIdentity,
    });

    this.distribution = new cloudfront.Distribution(
      this,
      "PublicWwwDistribution",
      {
        defaultRootObject: "index.html",
        domainNames: [domainName.valueAsString],
        certificate,
        enableLogging: true,
        logBucket: this.loggingBucket,
        logFilePrefix: "cloudfront-access-logs/",
        logIncludesCookies: false,
        defaultBehavior: {
          origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: noIndexResponseHeadersPolicy,
        },
      },
    );
    const cfnDistribution =
      this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.WebACLId",
      cdk.Fn.conditionIf(
        hasWafWebAclArn.logicalId,
        wafWebAclArn.valueAsString,
        cdk.Aws.NO_VALUE,
      ),
    );

    new cdk.CfnOutput(this, "PublicWwwBucketName", {
      value: this.bucket.bucketName,
    });

    new cdk.CfnOutput(this, "PublicWwwDistributionId", {
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, "PublicWwwDistributionDomain", {
      value: this.distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "PublicWwwLoggingBucketName", {
      value: this.loggingBucket.bucketName,
      description: "S3 bucket for CloudFront and S3 access logs",
    });
  }
}
