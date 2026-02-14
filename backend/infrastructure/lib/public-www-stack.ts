import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface WebsiteEnvironmentConfig {
  readonly idPrefix: "PublicWww" | "PublicWwwStaging";
  readonly environmentLabel: "production" | "staging";
  readonly domainName: string;
  readonly certificateArn: string;
  readonly bucketNamePrefix: string;
  readonly loggingBucketNamePrefix: string;
  readonly addNoIndexHeader: boolean;
  readonly hasWafWebAclArn: cdk.CfnCondition;
  readonly wafWebAclArn: cdk.CfnParameter;
}

interface WebsiteEnvironmentResources {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly loggingBucket: s3.Bucket;
}

export class PublicWwwStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly loggingBucket: s3.Bucket;
  public readonly stagingBucket: s3.Bucket;
  public readonly stagingDistribution: cloudfront.Distribution;
  public readonly stagingLoggingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Organization", "Evolve Sprouts");
    cdk.Tags.of(this).add("Project", "Public Website");

    const productionDomainName = new cdk.CfnParameter(this, "PublicWwwDomainName", {
      type: "String",
      description: "Custom domain for production public website (CloudFront alias).",
    });

    const productionCertificateArn = new cdk.CfnParameter(
      this,
      "PublicWwwCertificateArn",
      {
        type: "String",
        description: "ACM certificate ARN for production public website domain.",
      },
    );

    const stagingDomainName = new cdk.CfnParameter(
      this,
      "PublicWwwStagingDomainName",
      {
        type: "String",
        description: "Custom domain for staging public website (CloudFront alias).",
      },
    );

    const stagingCertificateArn = new cdk.CfnParameter(
      this,
      "PublicWwwStagingCertificateArn",
      {
        type: "String",
        description: "ACM certificate ARN for staging public website domain.",
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

    const productionResources = this.createWebsiteEnvironment({
      idPrefix: "PublicWww",
      environmentLabel: "production",
      domainName: productionDomainName.valueAsString,
      certificateArn: productionCertificateArn.valueAsString,
      bucketNamePrefix: "evolvesprouts-public-www",
      loggingBucketNamePrefix: "evolvesprouts-public-www-logs",
      addNoIndexHeader: false,
      hasWafWebAclArn,
      wafWebAclArn,
    });
    this.bucket = productionResources.bucket;
    this.distribution = productionResources.distribution;
    this.loggingBucket = productionResources.loggingBucket;

    const stagingResources = this.createWebsiteEnvironment({
      idPrefix: "PublicWwwStaging",
      environmentLabel: "staging",
      domainName: stagingDomainName.valueAsString,
      certificateArn: stagingCertificateArn.valueAsString,
      bucketNamePrefix: "evolvesprouts-staging-www",
      loggingBucketNamePrefix: "evolvesprouts-staging-www-logs",
      addNoIndexHeader: true,
      hasWafWebAclArn,
      wafWebAclArn,
    });
    this.stagingBucket = stagingResources.bucket;
    this.stagingDistribution = stagingResources.distribution;
    this.stagingLoggingBucket = stagingResources.loggingBucket;

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

    new cdk.CfnOutput(this, "PublicWwwStagingBucketName", {
      value: this.stagingBucket.bucketName,
    });

    new cdk.CfnOutput(this, "PublicWwwStagingDistributionId", {
      value: this.stagingDistribution.distributionId,
    });

    new cdk.CfnOutput(this, "PublicWwwStagingDistributionDomain", {
      value: this.stagingDistribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "PublicWwwStagingLoggingBucketName", {
      value: this.stagingLoggingBucket.bucketName,
      description: "S3 bucket for staging CloudFront and S3 access logs",
    });
  }

  private createWebsiteEnvironment(
    config: WebsiteEnvironmentConfig,
  ): WebsiteEnvironmentResources {
    const loggingBucketName = [
      config.loggingBucketNamePrefix,
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    const loggingBucket = new s3.Bucket(this, `${config.idPrefix}LoggingBucket`, {
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

    const loggingBucketCfn = loggingBucket.node.defaultChild as s3.CfnBucket;
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
      config.bucketNamePrefix,
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");
    const bucket = new s3.Bucket(this, `${config.idPrefix}Bucket`, {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsBucket: loggingBucket,
      serverAccessLogsPrefix: "s3-access-logs/",
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      `${config.idPrefix}Oai`,
      {
        comment: `OAI for ${config.environmentLabel} public website CloudFront distribution.`,
      },
    );
    bucket.grantRead(originAccessIdentity);

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      `${config.idPrefix}Certificate`,
      config.certificateArn,
    );

    const origin = origins.S3BucketOrigin.withOriginAccessIdentity(bucket, {
      originAccessIdentity,
    });
    const pathRewriteFunction = new cloudfront.Function(
      this,
      `${config.idPrefix}PathRewriteFunction`,
      {
        comment:
          "Rewrite extensionless and trailing-slash paths to index.html for static export.",
        runtime: cloudfront.FunctionRuntime.JS_2_0,
        code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Never rewrite Next.js static asset requests.
  if (uri.startsWith('/_next/')) {
    return request;
  }

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
    return request;
  }

  if (uri.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }

  return request;
}
`),
      },
    );

    const customHeaders: cloudfront.ResponseCustomHeader[] = [];
    if (config.addNoIndexHeader) {
      customHeaders.push({
        header: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive",
        override: true,
      });
    }

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      `${config.idPrefix}ResponseHeadersPolicy`,
      {
        comment: `Security headers for ${config.environmentLabel} public website distribution.`,
        customHeadersBehavior:
          customHeaders.length > 0
            ? {
                customHeaders,
              }
            : undefined,
        securityHeadersBehavior: {
          contentTypeOptions: {
            override: true,
          },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
      },
    );

    const distribution = new cloudfront.Distribution(
      this,
      `${config.idPrefix}Distribution`,
      {
        defaultRootObject: "index.html",
        domainNames: [config.domainName],
        certificate,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        enableLogging: true,
        logBucket: loggingBucket,
        logFilePrefix: "cloudfront-access-logs/",
        logIncludesCookies: false,
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: cdk.Duration.minutes(1),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: cdk.Duration.minutes(1),
          },
        ],
        defaultBehavior: {
          origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy,
          functionAssociations: [
            {
              function: pathRewriteFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
    );
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.WebACLId",
      cdk.Fn.conditionIf(
        config.hasWafWebAclArn.logicalId,
        config.wafWebAclArn.valueAsString,
        cdk.Aws.NO_VALUE,
      ),
    );

    return {
      bucket,
      distribution,
      loggingBucket,
    };
  }
}
