import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ses from "aws-cdk-lib/aws-ses";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as customresources from "aws-cdk-lib/custom-resources";
import { Construct, IConstruct } from "constructs";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { DatabaseConstruct, PythonLambdaFactory, STANDARD_LOG_RETENTION } from "./constructs";

class CdkInternalLambdaCheckovSuppression implements cdk.IAspect {
  public visit(node: IConstruct): void {
    const cfnType = (node as cdk.CfnResource).cfnResourceType;
    if (cfnType === "AWS::Lambda::Function") {
      const cfnNode = node as cdk.CfnResource;
      const nodePath = cfnNode.node.path;
      const isLogRetentionLambda = nodePath.includes("LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a");
      const isAwsCustomResourceLambda = nodePath.includes("AWS679f53fac002430cb0da5b7982bd2287");

      if (isLogRetentionLambda || isAwsCustomResourceLambda) {
        const comment = isLogRetentionLambda
          ? "CDK-internal LogRetention Lambda - runs only during deployments"
          : "CDK-internal AwsCustomResource Lambda - runs only during deployments";

        cfnNode.addMetadata("checkov", {
          skip: [
            { id: "CKV_AWS_115", comment },
            { id: "CKV_AWS_116", comment },
            { id: "CKV_AWS_117", comment },
          ],
        });
      }
    }

    const cfnPolicyType = (node as cdk.CfnResource).cfnResourceType;
    if (cfnPolicyType === "AWS::IAM::Policy") {
      const cfnNode = node as cdk.CfnResource;
      const nodePath = cfnNode.node.path;
      if (nodePath.includes("LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a") &&
          nodePath.includes("ServiceRole/DefaultPolicy")) {
        cfnNode.addMetadata("checkov", {
          skip: [
            {
              id: "CKV_AWS_111",
              comment: "CDK-internal LogRetention policy - required for log retention management",
            },
          ],
        });
      }
    }
  }
}

interface EventbriteSyncNestedStackProps extends cdk.NestedStackProps {
  resourcePrefix: string;
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  sharedLambdaEnvEncryptionKey: kms.IKey;
  sharedLambdaLogEncryptionKey: kms.IKey;
  sqsEncryptionKey: kms.IKey;
  databaseSecretArn: string;
  databaseProxyEndpoint: string;
  awsProxyFunctionArn: string;
  eventbriteApiBaseUrl: string;
  eventbriteOrganizationId: string;
  eventbriteTokenSecretArn: string;
}

class EventbriteSyncNestedStack extends cdk.NestedStack {
  public readonly topic: sns.Topic;
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly processorFunction: lambda.Function;

  public constructor(
    scope: Construct,
    id: string,
    props: EventbriteSyncNestedStackProps
  ) {
    super(scope, id, props);

    const name = (suffix: string) => `${props.resourcePrefix}-${suffix}`;
    const lambdaFactory = new PythonLambdaFactory(this, {
      vpc: props.vpc,
      securityGroups: [props.lambdaSecurityGroup],
      environmentEncryptionKey: props.sharedLambdaEnvEncryptionKey,
      logEncryptionKey: props.sharedLambdaLogEncryptionKey,
    });

    this.deadLetterQueue = new sqs.Queue(this, "EventbriteSyncDLQ", {
      queueName: name("eventbrite-sync-dlq"),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.sqsEncryptionKey,
    });

    this.queue = new sqs.Queue(this, "EventbriteSyncQueue", {
      queueName: name("eventbrite-sync-queue"),
      visibilityTimeout: cdk.Duration.seconds(120),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.sqsEncryptionKey,
    });

    this.topic = new sns.Topic(this, "EventbriteSyncTopic", {
      topicName: name("eventbrite-sync-events"),
      masterKey: props.sqsEncryptionKey,
    });
    this.topic.addSubscription(new snsSubscriptions.SqsSubscription(this.queue));

    this.processorFunction = lambdaFactory.create("EventbriteSyncProcessor", {
      functionName: name("EventbriteSyncProcessor"),
      handler: "lambda/eventbrite_sync_processor/handler.lambda_handler",
      timeout: cdk.Duration.seconds(60),
      manageLogGroup: false,
      environment: {
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_NAME: "evolvesprouts",
        DATABASE_USERNAME: "evolvesprouts_admin",
        DATABASE_PROXY_ENDPOINT: props.databaseProxyEndpoint,
        DATABASE_IAM_AUTH: "true",
        AWS_PROXY_FUNCTION_ARN: props.awsProxyFunctionArn,
        EVENTBRITE_API_BASE_URL: props.eventbriteApiBaseUrl,
        EVENTBRITE_ORGANIZATION_ID: props.eventbriteOrganizationId,
        EVENTBRITE_TOKEN_SECRET_ARN: props.eventbriteTokenSecretArn,
      },
    }).function;

    this.processorFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.queue, {
        batchSize: 1,
      })
    );

    const hasTokenSecret = new cdk.CfnCondition(
      this,
      "HasEventbriteTokenSecret",
      {
        expression: cdk.Fn.conditionNot(
          cdk.Fn.conditionEquals(props.eventbriteTokenSecretArn, "")
        ),
      }
    );
    const tokenSecretPolicy = new iam.Policy(
      this,
      "EventbriteTokenSecretPolicy",
      {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "secretsmanager:GetSecretValue",
              "secretsmanager:DescribeSecret",
            ],
            resources: [props.eventbriteTokenSecretArn],
          }),
        ],
      }
    );
    this.processorFunction.role!.attachInlinePolicy(tokenSecretPolicy);
    (
      tokenSecretPolicy.node.defaultChild as cdk.CfnResource
    ).cfnOptions.condition = hasTokenSecret;

    new cdk.aws_cloudwatch.Alarm(this, "EventbriteSyncDLQAlarm", {
      alarmName: name("eventbrite-sync-dlq-alarm"),
      alarmDescription:
        "Eventbrite sync messages failed processing and landed in DLQ",
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}

export class ApiStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Organization", "Evolve Sprouts");
    cdk.Tags.of(this).add("Project", "Backend");

    const resourcePrefix = "evolvesprouts";
    const name = (suffix: string) => `${resourcePrefix}-${suffix}`;
    const existingDbCredentialsSecretName =
      process.env.EXISTING_DB_CREDENTIALS_SECRET_NAME;
    const existingDbCredentialsSecretArn =
      process.env.EXISTING_DB_CREDENTIALS_SECRET_ARN;
    const existingDbCredentialsSecretKmsKeyArn =
      process.env.EXISTING_DB_CREDENTIALS_SECRET_KMS_KEY_ARN;
    const existingDbAppUserSecretName =
      process.env.EXISTING_DB_APP_USER_SECRET_NAME;
    const existingDbAppUserSecretArn =
      process.env.EXISTING_DB_APP_USER_SECRET_ARN;
    const existingDbAppUserSecretKmsKeyArn =
      process.env.EXISTING_DB_APP_USER_SECRET_KMS_KEY_ARN;
    const existingDbAdminUserSecretName =
      process.env.EXISTING_DB_ADMIN_USER_SECRET_NAME;
    const existingDbAdminUserSecretArn =
      process.env.EXISTING_DB_ADMIN_USER_SECRET_ARN;
    const existingDbAdminUserSecretKmsKeyArn =
      process.env.EXISTING_DB_ADMIN_USER_SECRET_KMS_KEY_ARN;
    const existingDbSecurityGroupId = process.env.EXISTING_DB_SECURITY_GROUP_ID;
    const existingProxySecurityGroupId =
      process.env.EXISTING_PROXY_SECURITY_GROUP_ID;
    const existingDbClusterIdentifier =
      process.env.EXISTING_DB_CLUSTER_IDENTIFIER;
    const existingDbClusterEndpoint = process.env.EXISTING_DB_CLUSTER_ENDPOINT;
    const existingDbClusterReaderEndpoint =
      process.env.EXISTING_DB_CLUSTER_READER_ENDPOINT;
    const existingDbClusterPort = parseOptionalPort(
      process.env.EXISTING_DB_CLUSTER_PORT
    );
    const existingDbProxyName = process.env.EXISTING_DB_PROXY_NAME;
    const existingDbProxyArn = process.env.EXISTING_DB_PROXY_ARN;
    const existingDbProxyEndpoint = process.env.EXISTING_DB_PROXY_ENDPOINT;
    const existingVpcId = process.env.EXISTING_VPC_ID?.trim();
    const existingLambdaSecurityGroupId =
      process.env.EXISTING_LAMBDA_SECURITY_GROUP_ID;
    const existingMigrationSecurityGroupId =
      process.env.EXISTING_MIGRATION_SECURITY_GROUP_ID;
    const manageDbSecurityGroupRules =
      !existingDbSecurityGroupId && !existingProxySecurityGroupId;
    const skipImmutableDbUpdates =
      parseOptionalBoolean(
        process.env.SKIP_DB_CLUSTER_IMMUTABLE_UPDATES
      ) ?? false;

    // ---------------------------------------------------------------------
    // VPC and Security Groups
    // ---------------------------------------------------------------------
    const vpc = existingVpcId
      ? ec2.Vpc.fromLookup(this, "ExistingVpc", { vpcId: existingVpcId })
      : new ec2.Vpc(this, "EvolvesproutsVpc", {
          vpcName: name("vpc"),
          maxAzs: 2,
          natGateways: 0,
          subnetConfiguration: [
            {
              name: "Public",
              subnetType: ec2.SubnetType.PUBLIC,
              cidrMask: 24,
            },
            {
              name: "Private",
              subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
              cidrMask: 24,
            },
          ],
        });

    vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    if (!existingVpcId) {
      const endpointSecurityGroup = new ec2.SecurityGroup(
        this,
        "VpcEndpointSecurityGroup",
        {
          vpc,
          description: "Security group for VPC endpoints",
          allowAllOutbound: false,
        }
      );
      endpointSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(vpc.vpcCidrBlock),
        ec2.Port.tcp(443),
        "Allow HTTPS from VPC"
      );

      vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        securityGroups: [endpointSecurityGroup],
      });

      vpc.addInterfaceEndpoint("StsEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.STS,
        securityGroups: [endpointSecurityGroup],
      });

      vpc.addInterfaceEndpoint("CloudWatchLogsEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        securityGroups: [endpointSecurityGroup],
      });

      // NOTE: Cognito VPC endpoint (PrivateLink) is NOT supported when the
      // User Pool has ManagedLogin configured.  Cognito admin operations
      // (ListUsers, AdminAddUserToGroup, etc.) are handled by a dedicated
      // Lambda that runs outside the VPC instead.

      vpc.addInterfaceEndpoint("SesEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.SES,
        securityGroups: [endpointSecurityGroup],
      });

      vpc.addInterfaceEndpoint("SnsEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.SNS,
        securityGroups: [endpointSecurityGroup],
      });

      vpc.addInterfaceEndpoint("RdsEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.RDS,
        securityGroups: [endpointSecurityGroup],
      });

      vpc.addInterfaceEndpoint("ApiGatewayEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
        securityGroups: [endpointSecurityGroup],
      });

      vpc.addInterfaceEndpoint("SqsEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.SQS,
        securityGroups: [endpointSecurityGroup],
      });

      vpc.addInterfaceEndpoint("LambdaEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
        securityGroups: [endpointSecurityGroup],
      });
    }

    const lambdaSecurityGroup = existingLambdaSecurityGroupId
      ? ec2.SecurityGroup.fromSecurityGroupId(
          this,
          "LambdaSecurityGroup",
          existingLambdaSecurityGroupId,
          { mutable: false }
        )
      : new ec2.SecurityGroup(this, "LambdaSecurityGroup", {
          vpc,
          allowAllOutbound: true,
          securityGroupName: name("lambda-sg"),
        });

    const migrationSecurityGroup = existingMigrationSecurityGroupId
      ? ec2.SecurityGroup.fromSecurityGroupId(
          this,
          "MigrationSecurityGroup",
          existingMigrationSecurityGroupId,
          { mutable: false }
        )
      : new ec2.SecurityGroup(this, "MigrationSecurityGroup", {
          vpc,
          allowAllOutbound: true,
          securityGroupName: name("migration-sg"),
        });

    const lambdaSecurityGroupResource =
      lambdaSecurityGroup.node.defaultChild as ec2.CfnSecurityGroup | undefined;
    if (lambdaSecurityGroupResource) {
      lambdaSecurityGroupResource.cfnOptions.updateReplacePolicy =
        cdk.CfnDeletionPolicy.RETAIN;
    }
    const migrationSecurityGroupResource =
      migrationSecurityGroup.node
        .defaultChild as ec2.CfnSecurityGroup | undefined;
    if (migrationSecurityGroupResource) {
      migrationSecurityGroupResource.cfnOptions.updateReplacePolicy =
        cdk.CfnDeletionPolicy.RETAIN;
    }

    // ---------------------------------------------------------------------
    // Database (Aurora PostgreSQL Serverless v2 + RDS Proxy)
    // ---------------------------------------------------------------------
    const database = new DatabaseConstruct(this, "Database", {
      resourcePrefix,
      vpc,
      minCapacity: 0.5,
      maxCapacity: 2,
      databaseName: "evolvesprouts",
      dbCredentialsSecretName: existingDbCredentialsSecretName,
      dbCredentialsSecretArn: existingDbCredentialsSecretArn,
      dbCredentialsSecretKmsKeyArn: existingDbCredentialsSecretKmsKeyArn,
      dbAppUserSecretName: existingDbAppUserSecretName,
      dbAppUserSecretArn: existingDbAppUserSecretArn,
      dbAppUserSecretKmsKeyArn: existingDbAppUserSecretKmsKeyArn,
      dbAdminUserSecretName: existingDbAdminUserSecretName,
      dbAdminUserSecretArn: existingDbAdminUserSecretArn,
      dbAdminUserSecretKmsKeyArn: existingDbAdminUserSecretKmsKeyArn,
      dbSecurityGroupId: existingDbSecurityGroupId,
      proxySecurityGroupId: existingProxySecurityGroupId,
      dbClusterIdentifier: existingDbClusterIdentifier,
      dbClusterEndpoint: existingDbClusterEndpoint,
      dbClusterReaderEndpoint: existingDbClusterReaderEndpoint,
      dbClusterPort: existingDbClusterPort,
      dbProxyName: existingDbProxyName,
      dbProxyArn: existingDbProxyArn,
      dbProxyEndpoint: existingDbProxyEndpoint,
      manageSecurityGroupRules: manageDbSecurityGroupRules,
      applyImmutableSettings: !skipImmutableDbUpdates,
    });

    database.allowFrom(lambdaSecurityGroup, "Lambda access to RDS Proxy");

    database.allowDirectAccessFrom(
      migrationSecurityGroup,
      "Migration Lambda direct access to Aurora"
    );

    // ---------------------------------------------------------------------
    // CloudFormation Parameters
    // ---------------------------------------------------------------------
    const authDomainPrefix = new cdk.CfnParameter(this, "CognitoDomainPrefix", {
      type: "String",
      description: "Hosted UI domain prefix for the Cognito user pool",
    });
    const authCustomDomainName = new cdk.CfnParameter(
      this,
      "CognitoCustomDomainName",
      {
        type: "String",
        default: "",
        description: "Optional custom Hosted UI domain (e.g. auth.example.com)",
      }
    );
    const authCustomDomainCertificateArn = new cdk.CfnParameter(
      this,
      "CognitoCustomDomainCertificateArn",
      {
        type: "String",
        default: "",
        description:
          "ACM certificate ARN for the custom Hosted UI domain (must be in us-east-1)",
      }
    );
    const oauthCallbackUrls = new cdk.CfnParameter(this, "CognitoCallbackUrls", {
      type: "CommaDelimitedList",
      description: "Comma-separated list of OAuth callback URLs",
    });
    const oauthLogoutUrls = new cdk.CfnParameter(this, "CognitoLogoutUrls", {
      type: "CommaDelimitedList",
      description: "Comma-separated list of OAuth logout URLs",
    });
    const googleClientId = new cdk.CfnParameter(this, "GoogleClientId", {
      type: "String",
      description: "Google OAuth client ID",
    });
    const googleClientSecret = new cdk.CfnParameter(this, "GoogleClientSecret", {
      type: "String",
      noEcho: true,
      description: "Google OAuth client secret",
    });
    const authEmailFromAddress = new cdk.CfnParameter(
      this,
      "AuthEmailFromAddress",
      {
        type: "String",
        description: "SES-verified from address for passwordless emails",
      }
    );
    const loginLinkBaseUrl = new cdk.CfnParameter(this, "LoginLinkBaseUrl", {
      type: "String",
      default: "",
      description:
        "Optional base URL for magic links (adds email+code query params)",
    });
    const maxChallengeAttempts = new cdk.CfnParameter(
      this,
      "MaxChallengeAttempts",
      {
        type: "Number",
        default: 3,
        description: "Maximum passwordless auth attempts before failing",
      }
    );
    const publicApiKeyValue = new cdk.CfnParameter(this, "PublicApiKeyValue", {
      type: "String",
      noEcho: true,
      minLength: 20,
      constraintDescription:
        "Must be at least 20 characters to satisfy API Gateway API key requirements.",
      description: "API key value required for mobile activity search",
    });
    const deviceAttestationJwksUrl = new cdk.CfnParameter(
      this,
      "DeviceAttestationJwksUrl",
      {
        type: "String",
        default: "",
        description: "JWKS URL for device attestation token verification",
      }
    );
    const deviceAttestationIssuer = new cdk.CfnParameter(
      this,
      "DeviceAttestationIssuer",
      {
        type: "String",
        default: "",
        description: "Expected issuer for device attestation tokens",
      }
    );
    const deviceAttestationAudience = new cdk.CfnParameter(
      this,
      "DeviceAttestationAudience",
      {
        type: "String",
        default: "",
        description: "Expected audience for device attestation tokens",
      }
    );
    const deviceAttestationFailClosed = new cdk.CfnParameter(
      this,
      "DeviceAttestationFailClosed",
      {
        type: "String",
        default: "true",
        allowedValues: ["true", "false"],
        description:
          "If true, deny requests when attestation is not configured (production mode). " +
          "If false, allow requests without attestation (development mode). " +
          "SECURITY: Must be 'true' in production.",
      }
    );

    // ---------------------------------------------------------------------
    // Migration Parameters
    // ---------------------------------------------------------------------
    const activeCountryCodes = new cdk.CfnParameter(
      this,
      "ActiveCountryCodes",
      {
        type: "String",
        default: "HK",
        description:
          "Comma-separated ISO 3166-1 alpha-2 country codes to activate " +
          "in the geographic_areas table (e.g., 'HK' or 'HK,SG'). " +
          "Countries not in this list will be deactivated on deploy.",
      }
    );

    const runSeedData = new cdk.CfnParameter(this, "RunSeedData", {
      type: "String",
      default: "false",
      allowedValues: ["true", "false"],
      description:
        "Run database seed data after migrations. Default false to allow " +
        "deployment to succeed even if seeding fails. Set to true and update " +
        "stack to seed after initial deployment.",
    });

    // ---------------------------------------------------------------------
    // Manager Access Request Email Parameters
    // ---------------------------------------------------------------------
    const supportEmail = new cdk.CfnParameter(this, "SupportEmail", {
      type: "String",
      default: "",
      description:
        "Email address to receive manager access request notifications. " +
        "Must be verified in SES.",
    });
    const sesSenderEmail = new cdk.CfnParameter(this, "SesSenderEmail", {
      type: "String",
      default: "",
      description:
        "SES-verified sender email address for access request notifications. " +
        "Can be the same as SupportEmail.",
    });
    const inboundEmailDomainName = new cdk.CfnParameter(
      this,
      "InboundEmailDomainName",
      {
        type: "String",
        description:
          "SES-verified subdomain used for inbound invoice email receiving (for example inbound.example.com).",
      }
    );
    const inboundInvoiceRecipientLocalPart = new cdk.CfnParameter(
      this,
      "InboundInvoiceRecipientLocalPart",
      {
        type: "String",
        default: "invoices",
        description:
          "Local-part for the SES-managed inbound invoice mailbox on the configured inbound email domain.",
      }
    );
    const inboundInvoiceAllowedSenderPatterns = new cdk.CfnParameter(
      this,
      "InboundInvoiceAllowedSenderPatterns",
      {
        type: "String",
        default: "",
        description:
          "Comma-separated substrings (case-insensitive). Inbound invoice mail " +
          "must match at least one pattern on SES envelope source or RFC822 From. " +
          "Empty disables allowlisting.",
      }
    );
    const turnstileSecretKey = new cdk.CfnParameter(
      this,
      "TurnstileSecretKey",
      {
        type: "String",
        noEcho: true,
        default: "",
        description: "Cloudflare Turnstile server-side secret key",
      }
    );
    const legacyPublicApiBaseUrl = new cdk.CfnParameter(
      this,
      "LegacyPublicApiBaseUrl",
      {
        type: "String",
        default: "",
        description:
          "Legacy public API base URL used by /v1/legacy/* bridge routes (for example https://api.evolvesprouts.com).",
      }
    );
    const legacyPublicApiKey = new cdk.CfnParameter(this, "LegacyPublicApiKey", {
      type: "String",
      noEcho: true,
      default: "",
      description:
        "Optional x-api-key injected by /v1/legacy/* bridge routes when upstream requires a different key.",
    });
    const mailchimpApiSecretArn = new cdk.CfnParameter(
      this,
      "MailchimpApiSecretArn",
      {
        type: "String",
        noEcho: true,
        description:
          "Existing Secrets Manager ARN containing the Mailchimp API key",
      }
    );
    const mailchimpListId = new cdk.CfnParameter(this, "MailchimpListId", {
      type: "String",
      description: "Mailchimp audience/list ID for media subscribers",
    });
    const mailchimpServerPrefix = new cdk.CfnParameter(
      this,
      "MailchimpServerPrefix",
      {
        type: "String",
        description: "Mailchimp API server prefix (for example us21)",
      }
    );
    const mailchimpWebhookSecret = new cdk.CfnParameter(
      this,
      "MailchimpWebhookSecret",
      {
        type: "String",
        noEcho: true,
        default: "",
        description:
          "Shared secret token required by the public Mailchimp webhook endpoint",
      }
    );
    const evolveSproutsStripeSecretKey = new cdk.CfnParameter(
      this,
      "EvolveSproutsStripeSecretKey",
      {
        type: "String",
        noEcho: true,
        default: "",
        description: "Stripe live secret key for inline modal reservation payments",
      }
    );
    const evolveSproutsStripeStagingSecretKey = new cdk.CfnParameter(
      this,
      "EvolveSproutsStripeStagingSecretKey",
      {
        type: "String",
        noEcho: true,
        default: "",
        description:
          "Stripe test secret key for staging public website reservation payments",
      }
    );
    const evolveSproutsStripePaymentMethodConfigurationId = new cdk.CfnParameter(
      this,
      "EvolveSproutsStripePaymentMethodConfigurationId",
      {
        type: "String",
        default: "",
        description:
          "Optional Stripe payment method configuration ID used for public reservation PaymentIntents",
      }
    );
    const mediaDefaultResourceKey = new cdk.CfnParameter(
      this,
      "MediaDefaultResourceKey",
      {
        type: "String",
        description:
          "Default media resource key used when media submissions omit resource_key",
      }
    );
    const openrouterApiKey = new cdk.CfnParameter(
      this,
      "OpenRouterApiKey",
      {
        type: "String",
        noEcho: true,
        description: "OpenRouter API key value (stored in Secrets Manager by CDK)",
      }
    );
    const openrouterChatCompletionsUrl = new cdk.CfnParameter(
      this,
      "OpenRouterChatCompletionsUrl",
      {
        type: "String",
        description: "OpenRouter chat completions URL used for invoice parsing",
      }
    );
    const openrouterModel = new cdk.CfnParameter(this, "OpenRouterModel", {
      type: "String",
      description: "OpenRouter model identifier for invoice parsing",
    });
    const openrouterMaxFileBytes = new cdk.CfnParameter(
      this,
      "OpenRouterMaxFileBytes",
      {
        type: "String",
        default: "15728640",
        description: "Maximum attachment size (bytes) sent to OpenRouter parser",
      }
    );

    // ---------------------------------------------------------------------
    // API Custom Domain Parameters (Optional)
    // ---------------------------------------------------------------------
    const apiCustomDomainName = new cdk.CfnParameter(
      this,
      "ApiCustomDomainName",
      {
        type: "String",
        default: "",
        description:
          "Optional custom domain for the API (e.g., evolvesprouts-api.lx-software.com). " +
          "Leave empty to use the default API Gateway URL.",
      }
    );
    const apiCustomDomainCertificateArn = new cdk.CfnParameter(
      this,
      "ApiCustomDomainCertificateArn",
      {
        type: "String",
        default: "",
        description:
          "ACM certificate ARN for the API custom domain. " +
          "For regional endpoints, must be in the same region as the API. " +
          "For edge-optimized endpoints, must be in us-east-1.",
      }
    );

    const nominatimUserAgent = new cdk.CfnParameter(
      this,
      "NominatimUserAgent",
      {
        type: "String",
        default: "",
        description:
          "User-Agent header for Nominatim address lookup requests",
      }
    );
    const nominatimReferer = new cdk.CfnParameter(
      this,
      "NominatimReferer",
      {
        type: "String",
        default: "",
        description:
          "Referer header for Nominatim address lookup requests",
      }
    );
    const publicWwwDomainName = new cdk.CfnParameter(
      this,
      "PublicWwwDomainName",
      {
        type: "String",
        description:
          "Production public website domain used for backend CORS allowlisting.",
      }
    );
    const publicWwwStagingDomainName = new cdk.CfnParameter(
      this,
      "PublicWwwStagingDomainName",
      {
        type: "String",
        description:
          "Staging public website domain used for backend CORS allowlisting.",
      }
    );
    const adminWebDomainName = new cdk.CfnParameter(this, "AdminWebDomainName", {
      type: "String",
      description: "Admin website domain used for backend CORS allowlisting.",
    });

    // ---------------------------------------------------------------------
    // Cognito User Pool and Identity Providers
    // ---------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, "EvolvesproutsUserPool", {
      userPoolName: name("user-pool"),
      signInAliases: { email: true },
      autoVerify: { email: true },
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      customAttributes: {
        // Legacy custom attribute retained to avoid immutable Cognito schema
        // update failures on existing user pools.
        feedback_stars: new cognito.StringAttribute({ mutable: true }),
        last_auth_time: new cognito.StringAttribute({ mutable: true }),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const adminGroupName = "admin";
    const userPoolGroups = [
      { name: adminGroupName, description: "Administrative users" },
      { name: "manager", description: "Manager users" },
      { name: "instructor", description: "Instructor users" },
    ];

    const googleProvider = new cognito.CfnUserPoolIdentityProvider(
      this,
      "GoogleIdentityProvider",
      {
        providerName: "Google",
        providerType: "Google",
        userPoolId: userPool.userPoolId,
        attributeMapping: {
          email: "email",
          given_name: "given_name",
          family_name: "family_name",
        },
        providerDetails: {
          client_id: googleClientId.valueAsString,
          client_secret: googleClientSecret.valueAsString,
          authorize_scopes: "openid email profile",
        },
      }
    );


    const useCustomDomain = new cdk.CfnCondition(this, "UseCustomAuthDomain", {
      expression: cdk.Fn.conditionAnd(
        cdk.Fn.conditionNot(
          cdk.Fn.conditionEquals(authCustomDomainName.valueAsString, "")
        ),
        cdk.Fn.conditionNot(
          cdk.Fn.conditionEquals(
            authCustomDomainCertificateArn.valueAsString,
            ""
          )
        )
      ),
    });
    const useCognitoDomain = new cdk.CfnCondition(
      this,
      "UseCognitoAuthDomain",
      {
        expression: cdk.Fn.conditionOr(
          cdk.Fn.conditionEquals(authCustomDomainName.valueAsString, ""),
          cdk.Fn.conditionEquals(
            authCustomDomainCertificateArn.valueAsString,
            ""
          )
        ),
      }
    );

    const cognitoHostedDomain = new cognito.CfnUserPoolDomain(
      this,
      "EvolvesproutsCognitoPrefixDomain",
      {
        userPoolId: userPool.userPoolId,
        domain: authDomainPrefix.valueAsString,
      }
    );
    cognitoHostedDomain.cfnOptions.condition = useCognitoDomain;

    // SECURITY: Use explicit policy with constrained resources instead of ANY_RESOURCE
    const removeCognitoDomainPolicy = customresources.AwsCustomResourcePolicy.fromStatements([
      new iam.PolicyStatement({
        actions: ["cognito-idp:DeleteUserPoolDomain"],
        resources: [userPool.userPoolArn],
      }),
    ]);

    const removeCognitoDomain = new customresources.AwsCustomResource(
      this,
      "RemoveCognitoAuthDomain",
      {
        onCreate: {
          service: "CognitoIdentityServiceProvider",
          action: "deleteUserPoolDomain",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Domain: authDomainPrefix.valueAsString,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `remove-cognito-domain-${userPool.userPoolId}`
          ),
          ignoreErrorCodesMatching: "ResourceNotFoundException|InvalidParameterException",
        },
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "deleteUserPoolDomain",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Domain: authDomainPrefix.valueAsString,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `remove-cognito-domain-${userPool.userPoolId}`
          ),
          ignoreErrorCodesMatching: "ResourceNotFoundException|InvalidParameterException",
        },
        policy: removeCognitoDomainPolicy,
        installLatestAwsSdk: false,
      }
    );
    const removeCognitoDomainCustomResource = (
      removeCognitoDomain as unknown as { customResource: cdk.CustomResource }
    ).customResource;
    const removeCognitoDomainResource =
      removeCognitoDomainCustomResource.node.defaultChild as cdk.CfnResource;
    removeCognitoDomainResource.cfnOptions.condition = useCustomDomain;

    const customHostedDomain = new cognito.CfnUserPoolDomain(
      this,
      "EvolvesproutsUserPoolCustomDomain",
      {
        userPoolId: userPool.userPoolId,
        domain: authCustomDomainName.valueAsString,
        customDomainConfig: {
          certificateArn: authCustomDomainCertificateArn.valueAsString,
        },
      }
    );
    customHostedDomain.cfnOptions.condition = useCustomDomain;
    customHostedDomain.node.addDependency(removeCognitoDomain);

    const userPoolClient = new cognito.CfnUserPoolClient(
      this,
      "EvolvesproutsUserPoolClient",
      {
        clientName: name("user-pool-client"),
        userPoolId: userPool.userPoolId,
        generateSecret: false,
        allowedOAuthFlowsUserPoolClient: true,
        allowedOAuthFlows: ["code"],
        allowedOAuthScopes: ["openid", "email", "profile"],
        callbackUrLs: oauthCallbackUrls.valueAsList,
        logoutUrLs: oauthLogoutUrls.valueAsList,
        supportedIdentityProviders: [
          "Google",
        ],
        explicitAuthFlows: [
          "ALLOW_CUSTOM_AUTH",
          "ALLOW_USER_SRP_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }
    );

    userPoolClient.addDependency(googleProvider);

    const groupPolicy = customresources.AwsCustomResourcePolicy.fromStatements([
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:CreateGroup",
          "cognito-idp:DeleteGroup",
        ],
        resources: [userPool.userPoolArn],
      }),
    ]);

    for (const group of userPoolGroups) {
      const groupId = group.name.charAt(0).toUpperCase() + group.name.slice(1);
      new customresources.AwsCustomResource(this, `UserGroup${groupId}`, {
        onCreate: {
          service: "CognitoIdentityServiceProvider",
          action: "createGroup",
          parameters: {
            UserPoolId: userPool.userPoolId,
            GroupName: group.name,
            Description: group.description,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `${userPool.userPoolId}-${group.name}`
          ),
          ignoreErrorCodesMatching: "GroupExistsException",
        },
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "createGroup",
          parameters: {
            UserPoolId: userPool.userPoolId,
            GroupName: group.name,
            Description: group.description,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `${userPool.userPoolId}-${group.name}`
          ),
          ignoreErrorCodesMatching: "GroupExistsException",
        },
        onDelete: {
          service: "CognitoIdentityServiceProvider",
          action: "deleteGroup",
          parameters: {
            UserPoolId: userPool.userPoolId,
            GroupName: group.name,
          },
          ignoreErrorCodesMatching: "ResourceNotFoundException",
        },
        policy: groupPolicy,
        installLatestAwsSdk: false,
      });
    }

    // ---------------------------------------------------------------------
    // Lambda Functions
    // ---------------------------------------------------------------------

    // Shared KMS keys for all Lambda functions to avoid per-function key
    // proliferation.  Each CMK costs $1/month; sharing two keys across all
    // functions instead of creating two per function saves ~$28/month.
    const sharedLambdaEnvEncryptionKey = new kms.Key(
      this,
      "SharedLambdaEnvEncryptionKey",
      {
        enableKeyRotation: true,
        alias: name("lambda-env-encryption-key"),
        description:
          "Shared KMS key for Lambda environment variable encryption",
      }
    );

    const sharedLambdaLogEncryptionKey = new kms.Key(
      this,
      "SharedLambdaLogEncryptionKey",
      {
        enableKeyRotation: true,
        alias: name("lambda-log-encryption-key"),
        description: "Shared KMS key for Lambda CloudWatch log encryption",
      }
    );

    sharedLambdaLogEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*",
        ],
        principals: [
          new iam.ServicePrincipal(
            `logs.${cdk.Stack.of(this).region}.amazonaws.com`
          ),
        ],
        resources: ["*"],
        conditions: {
          ArnLike: {
            "kms:EncryptionContext:aws:logs:arn": `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`,
          },
        },
      })
    );

    const lambdaFactory = new PythonLambdaFactory(this, {
      vpc,
      securityGroups: [lambdaSecurityGroup],
      environmentEncryptionKey: sharedLambdaEnvEncryptionKey,
      logEncryptionKey: sharedLambdaLogEncryptionKey,
    });

    // Factory for Lambda functions that run outside VPC (for authorizers that
    // need to fetch JWKS from public Cognito endpoints)
    const noVpcLambdaFactory = new PythonLambdaFactory(this, {
      environmentEncryptionKey: sharedLambdaEnvEncryptionKey,
      logEncryptionKey: sharedLambdaLogEncryptionKey,
    });

    // Helper to create Lambda functions using the factory
    // Function names use the standard prefix for consistent naming and
    // to ensure log groups follow the /aws/lambda/{functionName} convention.
    const createPythonFunction = (
      id: string,
      props: {
        handler: string;
        environment?: Record<string, string>;
        timeout?: cdk.Duration;
        extraCopyPaths?: string[];
        securityGroups?: ec2.ISecurityGroup[];
        memorySize?: number;
        // Set to true for functions that need internet access but not database
        // access (e.g., authorizers that fetch JWKS from Cognito)
        noVpc?: boolean;
        manageLogGroup?: boolean;
      }
    ) => {
      const factory = props.noVpc ? noVpcLambdaFactory : lambdaFactory;
      const pythonLambda = factory.create(id, {
        functionName: name(id),
        handler: props.handler,
        environment: props.environment,
        timeout: props.timeout,
        extraCopyPaths: props.extraCopyPaths,
        securityGroups: props.noVpc ? undefined : (props.securityGroups ?? [lambdaSecurityGroup]),
        memorySize: props.memorySize,
        manageLogGroup: props.manageLogGroup,
      });
      return pythonLambda.function;
    };

    const requiredCorsOrigins = [
      `https://${publicWwwDomainName.valueAsString}`,
      `https://${publicWwwStagingDomainName.valueAsString}`,
      `https://${adminWebDomainName.valueAsString}`,
    ];
    const corsAllowedOrigins = resolveCorsAllowedOrigins(
      this,
      requiredCorsOrigins
    );

    // Assets logging bucket
    const assetsLogBucketName = [
      name("assets-logs"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    const assetsLogBucket = new s3.Bucket(this, "AssetsLogBucket", {
      bucketName: assetsLogBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      lifecycleRules: [
        {
          id: "ExpireOldLogs",
          enabled: true,
          expiration: cdk.Duration.days(90),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    const assetsLogBucketCfn = assetsLogBucket.node
      .defaultChild as s3.CfnBucket;
    assetsLogBucketCfn.addMetadata("checkov", {
      skip: [
        {
          id: "CKV_AWS_18",
          comment:
            "Logging bucket - enabling access logging would create infinite loop",
        },
      ],
    });

    // Assets bucket
    const assetsBucketName = [
      name("assets"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    const assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      bucketName: assetsBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsBucket: assetsLogBucket,
      serverAccessLogsPrefix: "s3-access-logs/",
      intelligentTieringConfigurations: [
        {
          name: "AssetsTiering",
          archiveAccessTierTime: cdk.Duration.days(90),
          deepArchiveAccessTierTime: cdk.Duration.days(180),
        },
      ],
      lifecycleRules: [
        {
          id: "TransitionToIntelligentTiering",
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: "ExpireNoncurrentVersions",
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: corsAllowedOrigins,
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const inboundInvoiceRawEmailPrefix = "inbound-email/raw/";

    const assetDownloadCloudFrontPublicKeyPem = new cdk.CfnParameter(
      this,
      "AssetDownloadCloudFrontPublicKeyPem",
      {
        type: "String",
        description:
          "PEM-encoded RSA public key used for CloudFront-signed asset download URLs.",
      }
    );
    const assetDownloadCloudFrontPrivateKeySecretArn = new cdk.CfnParameter(
      this,
      "AssetDownloadCloudFrontPrivateKeySecretArn",
      {
        type: "String",
        noEcho: true,
        description:
          "Secrets Manager ARN containing JSON with private_key_pem for CloudFront asset URL signing.",
      }
    );
    const assetDownloadCustomDomainName = new cdk.CfnParameter(
      this,
      "AssetDownloadCustomDomainName",
      {
        type: "String",
        description:
          "Custom domain for asset downloads (for example media.evolvesprouts.com).",
      }
    );
    const assetDownloadCustomDomainCertificateArn = new cdk.CfnParameter(
      this,
      "AssetDownloadCustomDomainCertificateArn",
      {
        type: "String",
        description:
          "ACM certificate ARN for the asset download custom domain (must be in us-east-1).",
      }
    );
    const assetDownloadWafWebAclArn = new cdk.CfnParameter(
      this,
      "AssetDownloadWafWebAclArn",
      {
        type: "String",
        default: "",
        description:
          "Optional WAF WebACL ARN for asset CloudFront protection (must be from us-east-1).",
        allowedPattern: "^$|arn:aws:wafv2:us-east-1:[0-9]+:global/webacl/.+$",
        constraintDescription:
          "Must be empty or a valid WAF WebACL ARN from us-east-1.",
      }
    );
    const hasAssetDownloadWafWebAclArn = new cdk.CfnCondition(
      this,
      "HasAssetDownloadWafWebAclArn",
      {
        expression: cdk.Fn.conditionNot(
          cdk.Fn.conditionEquals(assetDownloadWafWebAclArn.valueAsString, "")
        ),
      }
    );
    const eventbriteTokenSecret = new cdk.CfnParameter(
      this,
      "EventbriteTokenSecretArn",
      {
        type: "String",
        default: "",
        noEcho: true,
        description:
          "Optional Secrets Manager ARN for Eventbrite API token JSON payload ({\"token\":\"...\"}).",
      }
    );
    const eventbriteOrganizationId = new cdk.CfnParameter(
      this,
      "EventbriteOrganizationId",
      {
        type: "String",
        default: "",
        description: "Optional Eventbrite organization ID for sync.",
      }
    );
    const eventbriteApiBaseUrl = new cdk.CfnParameter(
      this,
      "EventbriteApiBaseUrl",
      {
        type: "String",
        default: "https://www.eventbriteapi.com/v3",
        description: "Base URL for Eventbrite API.",
      }
    );

    const assetDownloadPublicKey = new cloudfront.PublicKey(
      this,
      "AssetDownloadPublicKey",
      {
        encodedKey: assetDownloadCloudFrontPublicKeyPem.valueAsString,
        comment: "Public key for asset CloudFront signed URLs.",
      }
    );
    const assetDownloadKeyGroup = new cloudfront.KeyGroup(
      this,
      "AssetDownloadKeyGroup",
      {
        items: [assetDownloadPublicKey],
        comment: "Trusted key group for asset CloudFront signed URLs.",
      }
    );
    const assetDownloadCustomDomainCertificate =
      acm.Certificate.fromCertificateArn(
        this,
        "AssetDownloadCustomDomainCertificate",
        assetDownloadCustomDomainCertificateArn.valueAsString
      );
    const assetDownloadDistribution = new cloudfront.Distribution(
      this,
      "ClientAssetsDownloadDistribution",
      {
        domainNames: [assetDownloadCustomDomainName.valueAsString],
        certificate: assetDownloadCustomDomainCertificate,
        enableLogging: true,
        logBucket: assetsLogBucket,
        logFilePrefix: "cloudfront-download-access-logs/",
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          trustedKeyGroups: [assetDownloadKeyGroup],
        },
      }
    );
    const assetDownloadDistributionCfn =
      assetDownloadDistribution.node.defaultChild as cloudfront.CfnDistribution;
    assetDownloadDistributionCfn.addPropertyOverride(
      "DistributionConfig.WebACLId",
      cdk.Fn.conditionIf(
        hasAssetDownloadWafWebAclArn.logicalId,
        assetDownloadWafWebAclArn.valueAsString,
        cdk.Aws.NO_VALUE
      )
    );

    // Admin function
    const adminFunction = createPythonFunction("EvolvesproutsAdminFunction", {
      handler: "lambda/admin/handler.lambda_handler",
      environment: {
        TURNSTILE_SECRET_KEY: turnstileSecretKey.valueAsString,
        DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
        DATABASE_NAME: "evolvesprouts",
        DATABASE_USERNAME: "evolvesprouts_admin",
        DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        CORS_ALLOWED_ORIGINS: corsAllowedOrigins.join(","),
        ASSETS_BUCKET_NAME: assetsBucket.bucketName,
        ASSET_PRESIGN_TTL_SECONDS: "900",
        ASSET_DOWNLOAD_LINK_EXPIRY_DAYS: "9999",
        ASSET_DOWNLOAD_CLOUDFRONT_DOMAIN:
          assetDownloadCustomDomainName.valueAsString,
        ASSET_SHARE_LINK_BASE_URL:
          `https://${assetDownloadCustomDomainName.valueAsString}`,
        ASSET_SHARE_LINK_DEFAULT_ALLOWED_DOMAINS:
          `${publicWwwDomainName.valueAsString},${publicWwwStagingDomainName.valueAsString}`,
        ASSET_DOWNLOAD_CLOUDFRONT_KEY_PAIR_ID: assetDownloadPublicKey.publicKeyId,
        ASSET_DOWNLOAD_CLOUDFRONT_PRIVATE_KEY_SECRET_ARN:
          assetDownloadCloudFrontPrivateKeySecretArn.valueAsString,
        MAILCHIMP_WEBHOOK_SECRET: mailchimpWebhookSecret.valueAsString,
        EVOLVESPROUTS_STRIPE_SECRET_KEY: evolveSproutsStripeSecretKey.valueAsString,
        EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY:
          evolveSproutsStripeStagingSecretKey.valueAsString,
        PUBLIC_WWW_STAGING_SITE_ORIGIN: `https://${publicWwwStagingDomainName.valueAsString}`,
        STRIPE_PAYMENT_METHOD_CONFIGURATION_ID:
          evolveSproutsStripePaymentMethodConfigurationId.valueAsString,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        ADMIN_GROUP: adminGroupName,
        INSTRUCTOR_GROUP: "instructor",
        LEGACY_PUBLIC_API_BASE_URL: legacyPublicApiBaseUrl.valueAsString,
        LEGACY_PUBLIC_API_KEY: legacyPublicApiKey.valueAsString,
        NOMINATIM_USER_AGENT: nominatimUserAgent.valueAsString,
        NOMINATIM_REFERER: nominatimReferer.valueAsString,
      },
    });
    database.grantAdminUserSecretRead(adminFunction);
    database.grantConnect(adminFunction, "evolvesprouts_admin");
    assetsBucket.grantReadWrite(adminFunction);
    secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "AssetDownloadPrivateKeySecret",
      assetDownloadCloudFrontPrivateKeySecretArn.valueAsString
    ).grantRead(adminFunction);

    // -----------------------------------------------------------------
    // AWS API Proxy Lambda (outside VPC)
    //
    // Generic proxy for AWS API calls that cannot be made from inside
    // the VPC (e.g. Cognito with ManagedLogin blocks PrivateLink).
    // In-VPC Lambdas invoke this proxy via Lambda-to-Lambda; the proxy
    // validates the request against an allow-list before executing it.
    // -----------------------------------------------------------------
    const allowedProxyActions = [
      "cognito-idp:list_users",
      "cognito-idp:list_users_in_group",
      "cognito-idp:admin_get_user",
      "cognito-idp:admin_delete_user",
      "cognito-idp:admin_add_user_to_group",
      "cognito-idp:admin_remove_user_from_group",
      "cognito-idp:admin_list_groups_for_user",
      "cognito-idp:admin_user_global_sign_out",
      "cognito-idp:admin_update_user_attributes",
    ];
    const allowedProxyHttpUrls = [
      "https://nominatim.openstreetmap.org/search",
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      `https://${mailchimpServerPrefix.valueAsString}.api.mailchimp.com/3.0/`,
      "https://api.stripe.com/v1/",
      `${legacyPublicApiBaseUrl.valueAsString}/v1/`,
      `${legacyPublicApiBaseUrl.valueAsString}v1/`,
      eventbriteApiBaseUrl.valueAsString,
      openrouterChatCompletionsUrl.valueAsString,
    ];

    const awsProxyFunction = createPythonFunction("AwsApiProxyFunction", {
      handler: "lambda/aws_proxy/handler.lambda_handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      noVpc: true,
      environment: {
        ALLOWED_ACTIONS: allowedProxyActions.join(","),
        ALLOWED_HTTP_URLS: allowedProxyHttpUrls.join(","),
      },
    });

    awsProxyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:ListUsers",
          "cognito-idp:ListUsersInGroup",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminUserGlobalSignOut",
          "cognito-idp:AdminUpdateUserAttributes",
        ],
        resources: [userPool.userPoolArn],
      })
    );

    adminFunction.addEnvironment(
      "AWS_PROXY_FUNCTION_ARN",
      awsProxyFunction.functionArn
    );
    awsProxyFunction.grantInvoke(adminFunction);

    const sesSenderIdentityArn = cdk.Stack.of(this).formatArn({
      service: "ses",
      resource: "identity",
      resourceName: sesSenderEmail.valueAsString,
    });
    const mailchimpApiSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "MailchimpApiSecret",
      mailchimpApiSecretArn.valueAsString
    );
    // SECURITY: Use customer-managed KMS key for Secrets Manager (Checkov CKV_AWS_149)
    const secretsEncryptionKey = new kms.Key(this, "SecretsEncryptionKey", {
      enableKeyRotation: true,
      alias: name("secrets-encryption-key"),
      description: "KMS key for Secrets Manager encryption",
    });
    const openrouterApiSecret = new secretsmanager.Secret(
      this,
      "OpenRouterApiSecret",
      {
        secretName: name("openrouter-api-secret"),
        description: "OpenRouter API key for invoice parsing",
        secretStringValue: cdk.SecretValue.unsafePlainText(
          openrouterApiKey.valueAsString
        ),
        encryptionKey: secretsEncryptionKey,
      }
    );

    // -------------------------------------------------------------------------
    // Booking Request Messaging (SNS + SQS)
    // -------------------------------------------------------------------------

    const sqsEncryptionKey = new kms.Key(this, "SqsEncryptionKey", {
      enableKeyRotation: true,
      alias: name("sqs-encryption-key"),
      description: "KMS key for SQS queue encryption",
    });
    const inboundInvoiceRecipientAddress = cdk.Fn.join("", [
      inboundInvoiceRecipientLocalPart.valueAsString,
      "@",
      inboundEmailDomainName.valueAsString,
    ]);

    const bookingRequestDLQ = new sqs.Queue(this, "BookingRequestDLQ", {
      queueName: name("booking-request-dlq"),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const bookingRequestQueue = new sqs.Queue(this, "BookingRequestQueue", {
      queueName: name("booking-request-queue"),
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: bookingRequestDLQ,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const bookingRequestTopic = new sns.Topic(this, "BookingRequestTopic", {
      topicName: name("booking-request-events"),
      masterKey: sqsEncryptionKey,
    });

    sqsEncryptionKey.grant(
      new iam.ServicePrincipal("sns.amazonaws.com"),
      "kms:GenerateDataKey*",
      "kms:Decrypt"
    );

    bookingRequestTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(bookingRequestQueue)
    );

    const bookingRequestProcessor = createPythonFunction(
      "BookingRequestProcessor",
      {
        handler: "lambda/manager_request_processor/handler.lambda_handler",
        timeout: cdk.Duration.seconds(10),
        environment: {
          DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
          DATABASE_NAME: "evolvesprouts",
          DATABASE_USERNAME: "evolvesprouts_admin",
          DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
          DATABASE_IAM_AUTH: "true",
          SES_SENDER_EMAIL: sesSenderEmail.valueAsString,
          SUPPORT_EMAIL: supportEmail.valueAsString,
        },
      }
    );

    database.grantAdminUserSecretRead(bookingRequestProcessor);
    database.grantConnect(bookingRequestProcessor, "evolvesprouts_admin");

    bookingRequestProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [sesSenderIdentityArn],
      })
    );

    bookingRequestProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(bookingRequestQueue, {
        batchSize: 1,
      })
    );

    const dlqAlarm = new cdk.aws_cloudwatch.Alarm(this, "BookingRequestDLQAlarm", {
      alarmName: name("booking-request-dlq-alarm"),
      alarmDescription: "Booking request messages failed processing and landed in DLQ",
      metric: bookingRequestDLQ.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // -------------------------------------------------------------------------
    // Media Request Messaging (SNS + SQS)
    // -------------------------------------------------------------------------

    const mediaDLQ = new sqs.Queue(this, "MediaDLQ", {
      queueName: name("media-dlq"),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const mediaQueue = new sqs.Queue(this, "MediaQueue", {
      queueName: name("media-queue"),
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: mediaDLQ,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const mediaTopic = new sns.Topic(this, "MediaTopic", {
      topicName: name("media-events"),
      masterKey: sqsEncryptionKey,
    });

    mediaTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(mediaQueue)
    );
    mediaTopic.grantPublish(adminFunction);
    adminFunction.addEnvironment("MEDIA_REQUEST_TOPIC_ARN", mediaTopic.topicArn);

    const mediaRequestProcessor = createPythonFunction(
      "MediaRequestProcessor",
      {
        handler: "lambda/media_processor/handler.lambda_handler",
        timeout: cdk.Duration.seconds(30),
        environment: {
          DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
          DATABASE_NAME: "evolvesprouts",
          DATABASE_USERNAME: "evolvesprouts_admin",
          DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
          DATABASE_IAM_AUTH: "true",
          SES_SENDER_EMAIL: sesSenderEmail.valueAsString,
          SUPPORT_EMAIL: supportEmail.valueAsString,
          MAILCHIMP_API_SECRET_ARN: mailchimpApiSecret.secretArn,
          MAILCHIMP_LIST_ID: mailchimpListId.valueAsString,
          MAILCHIMP_SERVER_PREFIX: mailchimpServerPrefix.valueAsString,
          MEDIA_DEFAULT_RESOURCE_KEY: mediaDefaultResourceKey.valueAsString,
          AWS_PROXY_FUNCTION_ARN: awsProxyFunction.functionArn,
        },
      }
    );

    database.grantAdminUserSecretRead(mediaRequestProcessor);
    database.grantConnect(mediaRequestProcessor, "evolvesprouts_admin");

    mediaRequestProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [sesSenderIdentityArn],
      })
    );
    mailchimpApiSecret.grantRead(mediaRequestProcessor);
    awsProxyFunction.grantInvoke(mediaRequestProcessor);

    mediaRequestProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(mediaQueue, {
        batchSize: 1,
      })
    );

    const mediaDlqAlarm = new cdk.aws_cloudwatch.Alarm(this, "MediaDLQAlarm", {
      alarmName: name("media-dlq-alarm"),
      alarmDescription:
        "Media request messages failed processing and landed in DLQ",
      metric: mediaDLQ.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // -------------------------------------------------------------------------
    // Expense Parser Messaging (SNS + SQS)
    // -------------------------------------------------------------------------

    const expenseParserDLQ = new sqs.Queue(this, "ExpenseParserDLQ", {
      queueName: name("expense-parser-dlq"),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const expenseParserQueue = new sqs.Queue(this, "ExpenseParserQueue", {
      queueName: name("expense-parser-queue"),
      visibilityTimeout: cdk.Duration.seconds(180),
      deadLetterQueue: {
        queue: expenseParserDLQ,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const expenseParserTopic = new sns.Topic(this, "ExpenseParserTopic", {
      topicName: name("expense-parser-events"),
      masterKey: sqsEncryptionKey,
    });
    expenseParserTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(expenseParserQueue)
    );
    expenseParserTopic.grantPublish(adminFunction);
    adminFunction.addEnvironment(
      "EXPENSE_PARSE_TOPIC_ARN",
      expenseParserTopic.topicArn
    );

    const expenseParserFunction = createPythonFunction("ExpenseParserFunction", {
      handler: "lambda/expense_parser/handler.lambda_handler",
      timeout: cdk.Duration.seconds(90),
      environment: {
        DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
        DATABASE_NAME: "evolvesprouts",
        DATABASE_USERNAME: "evolvesprouts_admin",
        DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        ASSETS_BUCKET_NAME: assetsBucket.bucketName,
        OPENROUTER_API_KEY_SECRET_ARN: openrouterApiSecret.secretArn,
        OPENROUTER_CHAT_COMPLETIONS_URL:
          openrouterChatCompletionsUrl.valueAsString,
        OPENROUTER_MODEL: openrouterModel.valueAsString,
        OPENROUTER_MAX_FILE_BYTES: openrouterMaxFileBytes.valueAsString,
        AWS_PROXY_FUNCTION_ARN: awsProxyFunction.functionArn,
      },
    });
    database.grantAdminUserSecretRead(expenseParserFunction);
    database.grantConnect(expenseParserFunction, "evolvesprouts_admin");
    assetsBucket.grantRead(expenseParserFunction);
    openrouterApiSecret.grantRead(expenseParserFunction);
    awsProxyFunction.grantInvoke(expenseParserFunction);

    expenseParserFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(expenseParserQueue, {
        batchSize: 1,
      })
    );

    const expenseParserDlqAlarm = new cdk.aws_cloudwatch.Alarm(
      this,
      "ExpenseParserDLQAlarm",
      {
        alarmName: name("expense-parser-dlq-alarm"),
        alarmDescription:
          "Expense parser messages failed processing and landed in DLQ",
        metric: expenseParserDLQ.metricApproximateNumberOfMessagesVisible({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // -------------------------------------------------------------------------
    // Eventbrite sync messaging (nested stack to reduce root stack size)
    // -------------------------------------------------------------------------
    const eventbriteSync = new EventbriteSyncNestedStack(
      this,
      "EventbriteSync",
      {
        resourcePrefix,
        vpc,
        lambdaSecurityGroup,
        sharedLambdaEnvEncryptionKey,
        sharedLambdaLogEncryptionKey,
        sqsEncryptionKey,
        databaseSecretArn: database.adminUserSecret.secretArn,
        databaseProxyEndpoint: database.proxy.endpoint,
        awsProxyFunctionArn: awsProxyFunction.functionArn,
        eventbriteApiBaseUrl: eventbriteApiBaseUrl.valueAsString,
        eventbriteOrganizationId: eventbriteOrganizationId.valueAsString,
        eventbriteTokenSecretArn: eventbriteTokenSecret.valueAsString,
      }
    );
    eventbriteSync.topic.grantPublish(adminFunction);
    adminFunction.addEnvironment(
      "EVENTBRITE_SYNC_TOPIC_ARN",
      eventbriteSync.topic.topicArn
    );
    database.grantAdminUserSecretRead(eventbriteSync.processorFunction);
    database.grantConnect(eventbriteSync.processorFunction, "evolvesprouts_admin");
    awsProxyFunction.grantInvoke(eventbriteSync.processorFunction);

    // -------------------------------------------------------------------------
    // Inbound invoice email processing (SES + S3 + SNS + SQS)
    // -------------------------------------------------------------------------

    const inboundInvoiceDLQ = new sqs.Queue(this, "InboundInvoiceDLQ", {
      queueName: name("inbound-invoice-email-dlq"),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const inboundInvoiceQueue = new sqs.Queue(this, "InboundInvoiceQueue", {
      queueName: name("inbound-invoice-email-queue"),
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: inboundInvoiceDLQ,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: sqsEncryptionKey,
    });

    const inboundInvoiceTopic = new sns.Topic(this, "InboundInvoiceTopic", {
      topicName: name("inbound-invoice-email-events"),
      masterKey: sqsEncryptionKey,
    });
    inboundInvoiceTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(inboundInvoiceQueue)
    );

    const inboundInvoiceProcessor = createPythonFunction(
      "InboundInvoiceEmailProcessor",
      {
        handler: "lambda/inbound_invoice_email/handler.lambda_handler",
        timeout: cdk.Duration.seconds(30),
        manageLogGroup: false,
        environment: {
          DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
          DATABASE_NAME: "evolvesprouts",
          DATABASE_USERNAME: "evolvesprouts_admin",
          DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
          DATABASE_IAM_AUTH: "true",
          ASSETS_BUCKET_NAME: assetsBucket.bucketName,
          EXPENSE_PARSE_TOPIC_ARN: expenseParserTopic.topicArn,
          INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS:
            inboundInvoiceAllowedSenderPatterns.valueAsString,
        },
      }
    );
    database.grantAdminUserSecretRead(inboundInvoiceProcessor);
    database.grantConnect(inboundInvoiceProcessor, "evolvesprouts_admin");
    assetsBucket.grantReadWrite(inboundInvoiceProcessor);
    expenseParserTopic.grantPublish(inboundInvoiceProcessor);
    inboundInvoiceProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(inboundInvoiceQueue, {
        batchSize: 1,
      })
    );

    const inboundInvoiceDlqAlarm = new cdk.aws_cloudwatch.Alarm(
      this,
      "InboundInvoiceDLQAlarm",
      {
        alarmName: name("inbound-invoice-email-dlq-alarm"),
        alarmDescription:
          "Inbound invoice email messages failed processing and landed in DLQ",
        metric: inboundInvoiceDLQ.metricApproximateNumberOfMessagesVisible({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    const inboundInvoiceReceiptRuleSetName = name(
      "inbound-invoice-email-rule-set"
    );
    const inboundInvoiceReceiptRuleName = name("inbound-invoice-email-rule");
    const inboundInvoiceReceiptRuleSourceArn = `arn:${cdk.Aws.PARTITION}:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:receipt-rule-set/${inboundInvoiceReceiptRuleSetName}:receipt-rule/${inboundInvoiceReceiptRuleName}`;
    sqsEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowSesInboundInvoiceTopicEncryption",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("ses.amazonaws.com")],
        actions: ["kms:GenerateDataKey*", "kms:Decrypt"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "AWS:SourceAccount": cdk.Aws.ACCOUNT_ID,
            "AWS:SourceArn": inboundInvoiceReceiptRuleSourceArn,
          },
        },
      })
    );
    const inboundInvoiceReceiptRole = new iam.Role(
      this,
      "InboundInvoiceReceiptRole",
      {
        assumedBy: new iam.ServicePrincipal("ses.amazonaws.com", {
          conditions: {
            StringEquals: {
              "AWS:SourceAccount": cdk.Aws.ACCOUNT_ID,
            },
            ArnLike: {
              "AWS:SourceArn": inboundInvoiceReceiptRuleSourceArn,
            },
          },
        }),
        description:
          "Allows SES receipt rules to store raw invoice emails in S3 and notify SNS",
      }
    );
    inboundInvoiceReceiptRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetBucketLocation", "s3:ListBucket"],
        resources: [assetsBucket.bucketArn],
      })
    );
    inboundInvoiceReceiptRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [
          `${assetsBucket.bucketArn}/${inboundInvoiceRawEmailPrefix}*`,
        ],
      })
    );
    inboundInvoiceTopic.grantPublish(inboundInvoiceReceiptRole);
    assetsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowSesInboundInvoiceWrites",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("ses.amazonaws.com")],
        actions: ["s3:PutObject"],
        resources: [`${assetsBucket.bucketArn}/${inboundInvoiceRawEmailPrefix}*`],
        conditions: {
          StringEquals: {
            "AWS:SourceAccount": cdk.Aws.ACCOUNT_ID,
            "AWS:SourceArn": inboundInvoiceReceiptRuleSourceArn,
          },
        },
      })
    );
    const assetsBucketPolicy = assetsBucket.policy;

    const inboundInvoiceReceiptRuleSet = new ses.CfnReceiptRuleSet(
      this,
      "InboundInvoiceReceiptRuleSet",
      {
        ruleSetName: inboundInvoiceReceiptRuleSetName,
      }
    );

    const inboundInvoiceReceiptRule = new ses.CfnReceiptRule(
      this,
      "InboundInvoiceReceiptRule",
      {
        ruleSetName: inboundInvoiceReceiptRuleSet.ref,
        rule: {
          name: inboundInvoiceReceiptRuleName,
          enabled: true,
          scanEnabled: true,
          tlsPolicy: "Optional",
          recipients: [inboundInvoiceRecipientAddress],
          actions: [
            {
              s3Action: {
                bucketName: assetsBucket.bucketName,
                objectKeyPrefix: inboundInvoiceRawEmailPrefix,
                topicArn: inboundInvoiceTopic.topicArn,
                iamRoleArn: inboundInvoiceReceiptRole.roleArn,
              },
            },
          ],
        },
      }
    );
    if (assetsBucketPolicy) {
      inboundInvoiceReceiptRule.node.addDependency(assetsBucketPolicy);
    }
    const receiptRoleDefaultPolicy =
      inboundInvoiceReceiptRole.node.tryFindChild("DefaultPolicy");
    if (receiptRoleDefaultPolicy) {
      inboundInvoiceReceiptRule.node.addDependency(receiptRoleDefaultPolicy);
    }

    const activateInboundInvoiceReceiptRuleSetPolicy =
      customresources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["ses:SetActiveReceiptRuleSet"],
          resources: ["*"],
        }),
      ]);
    const activateInboundInvoiceReceiptRuleSet =
      new customresources.AwsCustomResource(
        this,
        "ActivateInboundInvoiceReceiptRuleSet",
        {
          policy: activateInboundInvoiceReceiptRuleSetPolicy,
          installLatestAwsSdk: false,
          onCreate: {
            service: "SES",
            action: "setActiveReceiptRuleSet",
            parameters: {
              RuleSetName: inboundInvoiceReceiptRuleSet.ref,
            },
            physicalResourceId: customresources.PhysicalResourceId.of(
              `${name("inbound-invoice-email-rule-set")}-active`
            ),
          },
          onUpdate: {
            service: "SES",
            action: "setActiveReceiptRuleSet",
            parameters: {
              RuleSetName: inboundInvoiceReceiptRuleSet.ref,
            },
            physicalResourceId: customresources.PhysicalResourceId.of(
              `${name("inbound-invoice-email-rule-set")}-active`
            ),
          },
        }
      );
    activateInboundInvoiceReceiptRuleSet.node.addDependency(
      inboundInvoiceReceiptRule
    );

    // Migration function
    const migrationFunction = createPythonFunction("EvolvesproutsMigrationFunction", {
      handler: "lambda/migrations/handler.lambda_handler",
      timeout: cdk.Duration.minutes(5),
      securityGroups: [migrationSecurityGroup],
      extraCopyPaths: ["db"],
      environment: {
        DATABASE_SECRET_ARN: database.secret?.secretArn ?? "",
        DATABASE_NAME: "evolvesprouts",
        DATABASE_USERNAME: "postgres",
        DATABASE_IAM_AUTH: "false",
        DATABASE_HOST: database.cluster.clusterEndpoint.hostname,
        DATABASE_PORT: database.cluster.clusterEndpoint.port.toString(),
        DATABASE_APP_USER_SECRET_ARN: database.appUserSecret.secretArn,
        DATABASE_ADMIN_USER_SECRET_ARN: database.adminUserSecret.secretArn,
        SEED_FILE_PATH: "/var/task/db/seed/seed_data.sql",
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        ACTIVE_COUNTRY_CODES: activeCountryCodes.valueAsString,
      },
    });
    database.grantSecretRead(migrationFunction);
    database.grantAppUserSecretRead(migrationFunction);
    database.grantAdminUserSecretRead(migrationFunction);
    database.grantConnect(migrationFunction, "postgres");
    migrationFunction.node.addDependency(database.cluster);
    migrationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminAddUserToGroup",
        ],
        resources: [userPool.userPoolArn],
      })
    );
    migrationFunction.addPermission("MigrationInvokePermission", {
      principal: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
      sourceArn: cdk.Stack.of(this).stackId,
      sourceAccount: cdk.Stack.of(this).account,
    });

    // Auth Lambda triggers
    const preSignUpFunction = createPythonFunction("AuthPreSignUpFunction", {
      handler: "lambda/auth/pre_signup/handler.lambda_handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const defineAuthChallengeFunction = createPythonFunction(
      "AuthDefineChallengeFunction",
      {
        handler: "lambda/auth/define_auth_challenge/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          MAX_CHALLENGE_ATTEMPTS: maxChallengeAttempts.valueAsString,
        },
      }
    );

    const createAuthChallengeFunction = createPythonFunction(
      "AuthCreateChallengeFunction",
      {
        handler: "lambda/auth/create_auth_challenge/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          SES_FROM_ADDRESS: authEmailFromAddress.valueAsString,
          LOGIN_LINK_BASE_URL: loginLinkBaseUrl.valueAsString,
        },
      }
    );

    const sesIdentityArn = cdk.Stack.of(this).formatArn({
      service: "ses",
      resource: "identity",
      resourceName: authEmailFromAddress.valueAsString,
    });
    createAuthChallengeFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [sesIdentityArn],
      })
    );

    const verifyAuthChallengeFunction = createPythonFunction(
      "AuthVerifyChallengeFunction",
      {
        handler: "lambda/auth/verify_auth_challenge/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
      }
    );

    const postAuthFunction = createPythonFunction("AuthPostAuthFunction", {
      handler: "lambda/auth/post_authentication/handler.lambda_handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      noVpc: true,
    });
    postAuthFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminUpdateUserAttributes"],
        resources: ["*"],
      })
    );

    // Register Cognito triggers
    userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      preSignUpFunction
    );
    userPool.addTrigger(
      cognito.UserPoolOperation.DEFINE_AUTH_CHALLENGE,
      defineAuthChallengeFunction
    );
    userPool.addTrigger(
      cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
      createAuthChallengeFunction
    );
    userPool.addTrigger(
      cognito.UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE,
      verifyAuthChallengeFunction
    );
    userPool.addTrigger(
      cognito.UserPoolOperation.POST_AUTHENTICATION,
      postAuthFunction
    );

    // Device attestation authorizer
    // NOTE: Runs outside VPC to fetch JWKS from Firebase's public endpoint
    const deviceAttestationFunction = createPythonFunction(
      "DeviceAttestationAuthorizer",
      {
        handler: "lambda/authorizers/device_attestation/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(5),
        noVpc: true,
        environment: {
          ATTESTATION_JWKS_URL: deviceAttestationJwksUrl.valueAsString,
          ATTESTATION_ISSUER: deviceAttestationIssuer.valueAsString,
          ATTESTATION_AUDIENCE: deviceAttestationAudience.valueAsString,
          // SECURITY: Fail-closed mode denies requests when attestation is not configured
          ATTESTATION_FAIL_CLOSED: deviceAttestationFailClosed.valueAsString,
        },
      }
    );

    const deviceAttestationAuthorizer = new apigateway.RequestAuthorizer(
      this,
      "DeviceAttestationRequestAuthorizer",
      {
        handler: deviceAttestationFunction,
        identitySources: [
          apigateway.IdentitySource.header("x-device-attestation"),
        ],
        resultsCacheTtl: cdk.Duration.seconds(0),
      }
    );

    // Cognito group-based authorizer for admin-only endpoints
    // NOTE: Runs outside VPC to fetch JWKS from Cognito's public endpoint
    const adminGroupAuthorizerFunction = createPythonFunction(
      "AdminGroupAuthorizerFunction",
      {
        handler: "lambda/authorizers/cognito_group/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(5),
        noVpc: true,
        environment: {
          ALLOWED_GROUPS: adminGroupName,
        },
      }
    );

    const adminAuthorizer = new apigateway.RequestAuthorizer(
      this,
      "AdminGroupAuthorizer",
      {
        handler: adminGroupAuthorizerFunction,
        identitySources: [apigateway.IdentitySource.header("Authorization")],
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    // Cognito authorizer for any logged-in user (no group requirement)
    // NOTE: Runs outside VPC to fetch JWKS from Cognito's public endpoint
    const userAuthorizerFunction = createPythonFunction(
      "UserAuthorizerFunction",
      {
        handler: "lambda/authorizers/cognito_user/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(5),
        noVpc: true,
      }
    );

    const userAuthorizer = new apigateway.RequestAuthorizer(
      this,
      "UserAuthorizer",
      {
        handler: userAuthorizerFunction,
        identitySources: [apigateway.IdentitySource.header("Authorization")],
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    // Health check function
    const healthFunction = createPythonFunction("HealthCheckFunction", {
      handler: "lambda/health/handler.lambda_handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        DATABASE_SECRET_ARN: database.secret?.secretArn ?? "",
        DATABASE_NAME: "evolvesprouts",
        DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        DATABASE_USERNAME: "evolvesprouts_app",
        ENVIRONMENT: "production",
        APP_VERSION: "1.0.0",
      },
    });
    database.grantSecretRead(healthFunction);
    database.grantConnect(healthFunction, "evolvesprouts_app");

    // ---------------------------------------------------------------------
    // API Gateway
    // ---------------------------------------------------------------------
    const apiGatewayLogRole = new iam.Role(this, "ApiGatewayLogRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonAPIGatewayPushToCloudWatchLogs"
        ),
      ],
    });

    // -------------------------------------------------------------------------
    // API Gateway access logs
    // SECURITY: Encrypted with KMS key (Checkov requirement)
    // -------------------------------------------------------------------------
    const apiAccessLogGroupName = name("api-access-logs");

    const apiLogEncryptionKey = new kms.Key(this, "ApiLogEncryptionKey", {
      enableKeyRotation: true,
      alias: name("api-log-encryption-key"),
      description: "KMS key for API Gateway CloudWatch log encryption",
    });

    apiLogEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*",
        ],
        principals: [
          new iam.ServicePrincipal(
            `logs.${cdk.Stack.of(this).region}.amazonaws.com`
          ),
        ],
        resources: ["*"],
        conditions: {
          ArnLike: {
            "kms:EncryptionContext:aws:logs:arn": `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`,
          },
        },
      })
    );

    const apiAccessLogGroupArn = cdk.Stack.of(this).formatArn({
      service: "logs",
      resource: "log-group",
      resourceName: apiAccessLogGroupName,
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
    });
    const apiAccessLogGroupArnWildcard = `${apiAccessLogGroupArn}:*`;
    const apiAccessLogGroupPolicy =
      customresources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["logs:CreateLogGroup"],
          resources: [apiAccessLogGroupArn],
        }),
        new iam.PolicyStatement({
          actions: [
            "logs:AssociateKmsKey",
            "logs:PutRetentionPolicy",
          ],
          resources: [apiAccessLogGroupArnWildcard],
        }),
      ]);

    const apiAccessLogGroupCreator = new customresources.AwsCustomResource(
      this,
      "ApiAccessLogGroupCreator",
      {
        onCreate: {
          service: "CloudWatchLogs",
          action: "createLogGroup",
          parameters: {
            logGroupName: apiAccessLogGroupName,
            kmsKeyId: apiLogEncryptionKey.keyArn,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            apiAccessLogGroupName
          ),
          ignoreErrorCodesMatching: "ResourceAlreadyExistsException",
        },
        onUpdate: {
          service: "CloudWatchLogs",
          action: "createLogGroup",
          parameters: {
            logGroupName: apiAccessLogGroupName,
            kmsKeyId: apiLogEncryptionKey.keyArn,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            apiAccessLogGroupName
          ),
          ignoreErrorCodesMatching: "ResourceAlreadyExistsException",
        },
        policy: apiAccessLogGroupPolicy,
        installLatestAwsSdk: false,
      }
    );

    const apiAccessLogGroupRetention = new customresources.AwsCustomResource(
      this,
      "ApiAccessLogGroupRetention",
      {
        onCreate: {
          service: "CloudWatchLogs",
          action: "putRetentionPolicy",
          parameters: {
            logGroupName: apiAccessLogGroupName,
            retentionInDays: STANDARD_LOG_RETENTION,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `${apiAccessLogGroupName}-retention`
          ),
        },
        onUpdate: {
          service: "CloudWatchLogs",
          action: "putRetentionPolicy",
          parameters: {
            logGroupName: apiAccessLogGroupName,
            retentionInDays: STANDARD_LOG_RETENTION,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `${apiAccessLogGroupName}-retention`
          ),
        },
        policy: apiAccessLogGroupPolicy,
        installLatestAwsSdk: false,
      }
    );
    apiAccessLogGroupRetention.node.addDependency(apiAccessLogGroupCreator);

    const apiAccessLogGroupKey = new customresources.AwsCustomResource(
      this,
      "ApiAccessLogGroupKey",
      {
        onCreate: {
          service: "CloudWatchLogs",
          action: "associateKmsKey",
          parameters: {
            logGroupName: apiAccessLogGroupName,
            kmsKeyId: apiLogEncryptionKey.keyArn,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `${apiAccessLogGroupName}-kms`
          ),
        },
        onUpdate: {
          service: "CloudWatchLogs",
          action: "associateKmsKey",
          parameters: {
            logGroupName: apiAccessLogGroupName,
            kmsKeyId: apiLogEncryptionKey.keyArn,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `${apiAccessLogGroupName}-kms`
          ),
        },
        policy: apiAccessLogGroupPolicy,
        installLatestAwsSdk: false,
      }
    );
    apiAccessLogGroupKey.node.addDependency(apiAccessLogGroupCreator);

    const apiAccessLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      "ApiAccessLogs",
      apiAccessLogGroupName
    );

    // SECURITY: Restrict CORS to specific allowed origins
    // Never use Cors.ALL_ORIGINS in production - it allows any website to make requests
    const api = new apigateway.RestApi(this, "EvolvesproutsApi", {
      restApiName: name("api"),
      defaultCorsPreflightOptions: {
        allowOrigins: corsAllowedOrigins,
        allowMethods: ["GET", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Turnstile-Token",
        ],
      },
      deployOptions: {
        stageName: "prod",
        accessLogDestination: new apigateway.LogGroupLogDestination(
          apiAccessLogGroup
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: false,
        }),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        tracingEnabled: true,
        cacheClusterEnabled: true,
        cacheClusterSize: "0.5",
        cacheDataEncrypted: true,
        methodOptions: {
          // Share-token and download endpoints return per-request signed URLs
          // and must never be served from API Gateway stage cache.
          "/v1/assets/share/{token}/GET": {
            cachingEnabled: false,
          },
          "/v1/assets/public/{id}/download/GET": {
            cachingEnabled: false,
          },
          "/v1/user/assets/{id}/download/GET": {
            cachingEnabled: false,
          },
        },
      },
    });
    api.deploymentStage.node.addDependency(apiAccessLogGroupRetention);
    api.deploymentStage.node.addDependency(apiAccessLogGroupKey);

    // -------------------------------------------------------------------------
    // Gateway Responses – add CORS headers to API Gateway error responses
    //
    // Without these, 4XX/5XX errors generated by API Gateway itself (e.g.
    // authorizer denials, Lambda timeouts, integration errors) won't include
    // CORS headers, causing the browser to block the response.  The frontend
    // then sees a CORS / network error instead of a useful status code.
    // -------------------------------------------------------------------------
    const gatewayResponseTemplates: Record<string, string> = {
      "application/json": buildCorsOriginOverrideTemplate(corsAllowedOrigins),
    };
    const gatewayResponseHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": `'${corsAllowedOrigins[0]}'`,
      "Access-Control-Allow-Headers":
        "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Turnstile-Token'",
      "Access-Control-Allow-Methods": "'GET,POST,PUT,PATCH,DELETE,OPTIONS'",
      Vary: "'Origin'",
    };
    api.addGatewayResponse("GatewayResponseDefault4XX", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: gatewayResponseHeaders,
      templates: gatewayResponseTemplates,
    });
    api.addGatewayResponse("GatewayResponseDefault5XX", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: gatewayResponseHeaders,
      templates: gatewayResponseTemplates,
    });

    const publicWwwApiKey = new apigateway.ApiKey(this, "PublicWwwApiKey", {
      value: publicApiKeyValue.valueAsString,
    });
    const publicWwwUsagePlan = api.addUsagePlan("PublicWwwUsagePlan", {
      name: name("public-www-plan"),
    });
    publicWwwUsagePlan.addApiKey(publicWwwApiKey);
    publicWwwUsagePlan.addApiStage({ stage: api.deploymentStage });

    // -------------------------------------------------------------------------
    // API Key Rotation
    // SECURITY: Rotate API keys every 90 days to limit exposure from compromise
    // -------------------------------------------------------------------------

    const apiKeySecret = new secretsmanager.Secret(this, "ApiKeySecret", {
      secretName: name("api-key"),
      description: "Current mobile API key for rotation tracking",
      encryptionKey: secretsEncryptionKey,
    });

    const apiKeyRotationFunction = createPythonFunction("ApiKeyRotationFunction", {
      handler: "lambda/api_key_rotation/handler.lambda_handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      environment: {
        API_GATEWAY_REST_API_ID: api.restApiId,
        API_GATEWAY_USAGE_PLAN_ID: publicWwwUsagePlan.usagePlanId,
        API_KEY_SECRET_ARN: apiKeySecret.secretArn,
        API_KEY_NAME_PREFIX: name("public-www-key"),
        GRACE_PERIOD_HOURS: "24",
      },
    });

    apiKeyRotationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "apigateway:GET",
          "apigateway:POST",
          "apigateway:PUT",
          "apigateway:DELETE",
        ],
        resources: [
          `arn:aws:apigateway:${cdk.Stack.of(this).region}::/apikeys`,
          `arn:aws:apigateway:${cdk.Stack.of(this).region}::/apikeys/*`,
          `arn:aws:apigateway:${cdk.Stack.of(this).region}::/usageplans/${publicWwwUsagePlan.usagePlanId}`,
          `arn:aws:apigateway:${cdk.Stack.of(this).region}::/usageplans/${publicWwwUsagePlan.usagePlanId}/keys`,
          `arn:aws:apigateway:${cdk.Stack.of(this).region}::/usageplans/${publicWwwUsagePlan.usagePlanId}/keys/*`,
        ],
      })
    );

    apiKeySecret.grantRead(apiKeyRotationFunction);
    apiKeySecret.grantWrite(apiKeyRotationFunction);

    const apiKeyRotationRule = new cdk.aws_events.Rule(this, "ApiKeyRotationSchedule", {
      ruleName: name("api-key-rotation"),
      description: "Rotate mobile API key every 90 days",
      schedule: cdk.aws_events.Schedule.rate(cdk.Duration.days(90)),
    });
    apiKeyRotationRule.addTarget(
      new cdk.aws_events_targets.LambdaFunction(apiKeyRotationFunction, {
        retryAttempts: 2,
      })
    );

    // ---------------------------------------------------------------------
    // API Routes
    // ---------------------------------------------------------------------

    // Health check endpoint (IAM auth)
    const health = api.root.addResource("health");
    health.addMethod("GET", new apigateway.LambdaIntegration(healthFunction), {
      authorizationType: apigateway.AuthorizationType.IAM,
    });

    const v1 = api.root.addResource("v1");

    const adminIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.AWS_PROXY,
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${adminFunction.functionArn}/invocations`,
    });
    adminFunction.addPermission("AdminApiInvokePermission", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: api.arnForExecuteApi(),
    });

    const mediaRequest = v1.addResource("media-request");
    mediaRequest.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
    });
    const calendar = v1.addResource("calendar");
    calendar.addResource("events").addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
    });
    const reservations = v1.addResource("reservations");
    reservations.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
    });
    reservations.addResource("payment-intent").addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
    });
    const legacy = v1.addResource("legacy");
    legacy.addResource("reservations").addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
    });
    legacy.addResource("contact-us").addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
    });
    legacy
      .addResource("discounts")
      .addResource("validate")
      .addMethod("POST", adminIntegration, {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
      });
    const mailchimpWebhook = v1.addResource("mailchimp").addResource("webhook");
    const mailchimpWebhookPostMethod = mailchimpWebhook.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });
    const mailchimpWebhookGetMethod = mailchimpWebhook.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });
    // This endpoint is intentionally public for Mailchimp callbacks and is
    // protected in-app with mandatory shared-secret verification.
    addCheckovMethodSuppression(mailchimpWebhookPostMethod, "CKV_AWS_59",
      "Public Mailchimp webhook endpoint; access is validated via MAILCHIMP_WEBHOOK_SECRET in Lambda handler.");
    addCheckovMethodSuppression(mailchimpWebhookGetMethod, "CKV_AWS_59",
      "Public Mailchimp webhook verification endpoint; access is validated via MAILCHIMP_WEBHOOK_SECRET in Lambda handler.");

    // Admin asset routes
    const admin = v1.addResource("admin");
    const adminAssets = admin.addResource("assets");
    adminAssets.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminAssets.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminAssetById = adminAssets.addResource("{id}");
    adminAssetById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminAssetById.addMethod("PUT", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminAssetById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminAssetById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminAssetGrants = adminAssetById.addResource("grants");
    adminAssetGrants.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminAssetGrants.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminAssetGrantById = adminAssetGrants.addResource("{grantId}");
    adminAssetGrantById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminAssetShareLink = adminAssetById.addResource("share-link");
    adminAssetShareLink.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminAssetShareLink.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminAssetShareLink.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminAssetShareLinkRotate = adminAssetShareLink.addResource("rotate");
    adminAssetShareLinkRotate.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminGeographicAreas = admin.addResource("geographic-areas");
    adminGeographicAreas.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminLocations = admin.addResource("locations");
    adminLocations.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminLocations.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminLocationsGeocode = adminLocations.addResource("geocode");
    adminLocationsGeocode.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminLocationById = adminLocations.addResource("{id}");
    adminLocationById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminLocationById.addMethod("PUT", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminLocationById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminLocationById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // Admin lead routes
    const adminLeads = admin.addResource("leads");
    adminLeads.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminLeads.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminLeadAnalytics = adminLeads.addResource("analytics");
    adminLeadAnalytics.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminLeadExport = adminLeads.addResource("export");
    adminLeadExport.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminLeadById = adminLeads.addResource("{id}");
    adminLeadById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminLeadById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminLeadNotes = adminLeadById.addResource("notes");
    adminLeadNotes.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // Admin users route for assignee picker
    const adminUsers = admin.addResource("users");
    adminUsers.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminInstructors = admin.addResource("instructors");
    adminInstructors.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // Admin service routes
    const adminServices = admin.addResource("services");
    adminServices.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminServices.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminServicesAllInstances = adminServices.addResource("instances");
    adminServicesAllInstances.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminServiceById = adminServices.addResource("{id}");
    adminServiceById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminServiceById.addMethod("PUT", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminServiceById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminServiceById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminServiceCoverImage = adminServiceById.addResource("cover-image");
    adminServiceCoverImage.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminServiceInstances = adminServiceById.addResource("instances");
    adminServiceInstances.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminServiceInstances.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminServiceInstanceById = adminServiceInstances.addResource("{instanceId}");
    adminServiceInstanceById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminServiceInstanceById.addMethod("PUT", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminServiceInstanceById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminInstanceEnrollments = adminServiceInstanceById.addResource("enrollments");
    adminInstanceEnrollments.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminInstanceEnrollments.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminEnrollmentById = adminInstanceEnrollments.addResource("{enrollmentId}");
    adminEnrollmentById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminEnrollmentById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // Admin discount code routes
    const adminDiscountCodes = admin.addResource("discount-codes");
    adminDiscountCodes.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminDiscountCodes.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminDiscountCodeById = adminDiscountCodes.addResource("{id}");
    adminDiscountCodeById.addMethod("PUT", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminDiscountCodeById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // Admin CRM contacts / families / organizations (non-vendor)
    const adminContacts = admin.addResource("contacts");
    adminContacts.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminContacts.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminContactsTags = adminContacts.addResource("tags");
    adminContactsTags.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminContactsSearch = adminContacts.addResource("search");
    adminContactsSearch.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminContactById = adminContacts.addResource("{id}");
    adminContactById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminContactById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminFamilies = admin.addResource("families");
    const adminFamiliesPicker = adminFamilies.addResource("picker");
    adminFamiliesPicker.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminFamilies.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminFamilies.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminFamilyById = adminFamilies.addResource("{id}");
    adminFamilyById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminFamilyById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminFamilyMembers = adminFamilyById.addResource("members");
    adminFamilyMembers.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminFamilyMemberById = adminFamilyMembers.addResource("{memberId}");
    adminFamilyMemberById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminOrganizationsCrm = admin.addResource("organizations");
    const adminOrganizationsCrmPicker = adminOrganizationsCrm.addResource("picker");
    adminOrganizationsCrmPicker.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminOrganizationsCrm.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminOrganizationsCrm.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminOrganizationCrmById = adminOrganizationsCrm.addResource("{id}");
    adminOrganizationCrmById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminOrganizationCrmById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminOrganizationCrmMembers = adminOrganizationCrmById.addResource("members");
    adminOrganizationCrmMembers.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminOrganizationCrmMemberById = adminOrganizationCrmMembers.addResource("{memberId}");
    adminOrganizationCrmMemberById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // Admin vendor routes
    const adminVendors = admin.addResource("vendors");
    adminVendors.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminVendors.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminVendorById = adminVendors.addResource("{id}");
    adminVendorById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminVendorById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // Admin expense routes
    const adminExpenses = admin.addResource("expenses");
    adminExpenses.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminExpenses.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminExpenseById = adminExpenses.addResource("{id}");
    adminExpenseById.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminExpenseById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminExpenseById.addResource("cancel").addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminExpenseById.addResource("mark-paid").addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminExpenseById.addResource("reparse").addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminExpenseById.addResource("amend").addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    // User asset routes
    const user = v1.addResource("user");
    const userAssets = user.addResource("assets");
    userAssets.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: userAuthorizer,
    });

    const userAssetById = userAssets.addResource("{id}");
    const userAssetDownload = userAssetById.addResource("download");
    userAssetDownload.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: userAuthorizer,
    });

    // Public asset routes (API key + device attestation)
    const assets = v1.addResource("assets");
    const publicAssets = assets.addResource("public");
    publicAssets.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: deviceAttestationAuthorizer,
      apiKeyRequired: true,
    });

    const publicAssetById = publicAssets.addResource("{id}");
    const publicAssetDownload = publicAssetById.addResource("download");
    publicAssetDownload.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: deviceAttestationAuthorizer,
      apiKeyRequired: true,
    });

    const publicShareAssets = assets.addResource("share");
    const publicShareAssetByToken = publicShareAssets.addResource("{token}");
    publicShareAssetByToken.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      // Keep the bearer-link UX public while preventing open API access:
      // CloudFront injects x-api-key for this origin behavior.
      apiKeyRequired: true,
    });

    // Route media-domain share links to API Gateway.
    const assetShareApiOrigin = new origins.HttpOrigin(
      `${api.restApiId}.execute-api.${cdk.Stack.of(this).region}.${cdk.Stack.of(this).urlSuffix}`,
      {
        originPath: `/${api.deploymentStage.stageName}`,
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        customHeaders: {
          "x-api-key": publicApiKeyValue.valueAsString,
        },
      }
    );
    assetDownloadDistribution.addBehavior("v1/assets/share/*", assetShareApiOrigin, {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    });

    // ---------------------------------------------------------------------
    // Admin Bootstrap (Conditional)
    // ---------------------------------------------------------------------
    const adminBootstrapEmail = new cdk.CfnParameter(
      this,
      "AdminBootstrapEmail",
      {
        type: "String",
        default: "",
        description: "Optional admin email for bootstrap user creation",
      }
    );
    const adminBootstrapPassword = new cdk.CfnParameter(
      this,
      "AdminBootstrapTempPassword",
      {
        type: "String",
        default: "",
        noEcho: true,
        description: "Temporary password for bootstrap admin user",
      }
    );
    const bootstrapCondition = new cdk.CfnCondition(
      this,
      "CreateAdminBootstrap",
      {
        expression: cdk.Fn.conditionAnd(
          cdk.Fn.conditionNot(
            cdk.Fn.conditionEquals(adminBootstrapEmail.valueAsString, "")
          ),
          cdk.Fn.conditionNot(
            cdk.Fn.conditionEquals(adminBootstrapPassword.valueAsString, "")
          )
        ),
      }
    );

    const adminBootstrapFunction = createPythonFunction(
      "AdminBootstrapFunction",
      {
        handler: "lambda/admin_bootstrap/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(30),
      }
    );
    adminBootstrapFunction.addPermission(
      "AdminBootstrapInvokePermission",
      {
        principal: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
        sourceArn: cdk.Stack.of(this).stackId,
        sourceAccount: cdk.Stack.of(this).account,
      }
    );

    adminBootstrapFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminAddUserToGroup",
        ],
        resources: [userPool.userPoolArn],
      })
    );

    const adminBootstrapResource = new cdk.CustomResource(
      this,
      "AdminBootstrapResource",
      {
        serviceToken: adminBootstrapFunction.functionArn,
        properties: {
          UserPoolId: userPool.userPoolId,
          Email: adminBootstrapEmail.valueAsString,
          TempPassword: adminBootstrapPassword.valueAsString,
          GroupName: adminGroupName,
        },
      }
    );
    const adminBootstrapCfn =
      adminBootstrapResource.node.defaultChild as cdk.CfnResource;
    adminBootstrapCfn.cfnOptions.condition = bootstrapCondition;

    // ---------------------------------------------------------------------
    // Database Migrations
    // ---------------------------------------------------------------------
    const migrationsHash = hashDirectory(
      path.join(__dirname, "../../db/alembic/versions")
    );
    const seedHash = hashFile(path.join(__dirname, "../../db/seed/seed_data.sql"));
    const proxyUserSecretHash = hashValue(
      [
        database.appUserSecret.secretArn,
        database.adminUserSecret.secretArn,
      ].join("|")
    );
    const migrationsForceRunId =
      process.env.MIGRATIONS_FORCE_RUN_ID?.trim() ?? "";

    const migrateResource = new cdk.CustomResource(this, "RunMigrations", {
      serviceToken: migrationFunction.functionArn,
      properties: {
        MigrationsHash: migrationsHash,
        SeedHash: seedHash,
        ProxyUserSecretHash: proxyUserSecretHash,
        MigrationsForceRunId: migrationsForceRunId,
        RunSeed: runSeedData.valueAsString,
      },
    });
    migrateResource.node.addDependency(database.cluster);

    // ---------------------------------------------------------------------
    // API Custom Domain (Conditional)
    // ---------------------------------------------------------------------
    const useApiCustomDomain = new cdk.CfnCondition(this, "UseApiCustomDomain", {
      expression: cdk.Fn.conditionAnd(
        cdk.Fn.conditionNot(
          cdk.Fn.conditionEquals(apiCustomDomainName.valueAsString, "")
        ),
        cdk.Fn.conditionNot(
          cdk.Fn.conditionEquals(apiCustomDomainCertificateArn.valueAsString, "")
        )
      ),
    });

    const apiCertificate = acm.Certificate.fromCertificateArn(
      this,
      "ApiCertificate",
      apiCustomDomainCertificateArn.valueAsString
    );

    const apiDomain = new apigateway.DomainName(this, "ApiCustomDomain", {
      domainName: apiCustomDomainName.valueAsString,
      certificate: apiCertificate,
      endpointType: apigateway.EndpointType.REGIONAL,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    });
    const apiDomainCfn = apiDomain.node.defaultChild as apigateway.CfnDomainName;
    apiDomainCfn.cfnOptions.condition = useApiCustomDomain;

    const apiMapping = new apigateway.BasePathMapping(this, "ApiBasePathMapping", {
      domainName: apiDomain,
      restApi: api,
      stage: api.deploymentStage,
    });
    const apiMappingCfn = apiMapping.node.defaultChild as apigateway.CfnBasePathMapping;
    apiMappingCfn.cfnOptions.condition = useApiCustomDomain;

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: database.secret?.secretArn ?? "",
    });

    new cdk.CfnOutput(this, "DatabaseProxyEndpoint", {
      value: database.proxy.endpoint,
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.ref,
    });

    new cdk.CfnOutput(this, "AssetsBucketName", {
      value: assetsBucket.bucketName,
    });

    new cdk.CfnOutput(this, "AssetsLogBucketName", {
      value: assetsLogBucket.bucketName,
    });
    new cdk.CfnOutput(this, "AssetsDownloadDistributionDomain", {
      value: assetDownloadDistribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "AssetsDownloadCloudFrontKeyPairId", {
      value: assetDownloadPublicKey.publicKeyId,
    });
    new cdk.CfnOutput(this, "AssetsDownloadCustomDomainTarget", {
      value: assetDownloadDistribution.distributionDomainName,
      description:
        "CNAME target for the asset download custom domain in DNS.",
    });
    new cdk.CfnOutput(this, "AssetsDownloadCustomDomainUrl", {
      value: `https://${assetDownloadCustomDomainName.valueAsString}`,
      description: "Asset download custom domain URL.",
    });

    new cdk.CfnOutput(this, "BookingRequestTopicArn", {
      value: bookingRequestTopic.topicArn,
      description: "SNS topic ARN for booking request events",
    });

    new cdk.CfnOutput(this, "BookingRequestQueueUrl", {
      value: bookingRequestQueue.queueUrl,
      description: "SQS queue URL for booking request processing",
    });

    new cdk.CfnOutput(this, "BookingRequestDLQUrl", {
      value: bookingRequestDLQ.queueUrl,
      description: "SQS dead letter queue URL for failed booking requests",
    });

    new cdk.CfnOutput(this, "MediaTopicArn", {
      value: mediaTopic.topicArn,
      description: "SNS topic ARN for media request events",
    });

    new cdk.CfnOutput(this, "MediaQueueUrl", {
      value: mediaQueue.queueUrl,
      description: "SQS queue URL for media request processing",
    });

    new cdk.CfnOutput(this, "MediaDLQUrl", {
      value: mediaDLQ.queueUrl,
      description: "SQS dead letter queue URL for failed media requests",
    });
    new cdk.CfnOutput(this, "ExpenseParserTopicArn", {
      value: expenseParserTopic.topicArn,
      description: "SNS topic ARN for expense parser events",
    });
    new cdk.CfnOutput(this, "ExpenseParserQueueUrl", {
      value: expenseParserQueue.queueUrl,
      description: "SQS queue URL for expense parser processing",
    });
    new cdk.CfnOutput(this, "ExpenseParserDLQUrl", {
      value: expenseParserDLQ.queueUrl,
      description: "SQS dead letter queue URL for failed expense parser jobs",
    });
    new cdk.CfnOutput(this, "EventbriteSyncTopicArn", {
      value: eventbriteSync.topic.topicArn,
      description: "SNS topic ARN for Eventbrite sync events",
    });
    new cdk.CfnOutput(this, "EventbriteSyncQueueUrl", {
      value: eventbriteSync.queue.queueUrl,
      description: "SQS queue URL for Eventbrite sync processing",
    });
    new cdk.CfnOutput(this, "EventbriteSyncDLQUrl", {
      value: eventbriteSync.deadLetterQueue.queueUrl,
      description: "SQS dead letter queue URL for failed Eventbrite sync jobs",
    });
    new cdk.CfnOutput(this, "InboundInvoiceRecipientAddress", {
      value: inboundInvoiceRecipientAddress,
      description: "SES-managed inbound recipient address for invoice automation",
    });
    new cdk.CfnOutput(this, "InboundInvoiceRawEmailPrefix", {
      value: inboundInvoiceRawEmailPrefix,
      description:
        "Reserved object-key prefix in AssetsBucket for raw inbound invoice emails",
    });
    new cdk.CfnOutput(this, "InboundInvoiceTopicArn", {
      value: inboundInvoiceTopic.topicArn,
      description: "SNS topic ARN for inbound invoice email events",
    });
    new cdk.CfnOutput(this, "InboundInvoiceQueueUrl", {
      value: inboundInvoiceQueue.queueUrl,
      description: "SQS queue URL for inbound invoice email processing",
    });
    new cdk.CfnOutput(this, "InboundInvoiceDLQUrl", {
      value: inboundInvoiceDLQ.queueUrl,
      description: "SQS dead letter queue URL for failed inbound invoice emails",
    });
    new cdk.CfnOutput(this, "InboundInvoiceMxTarget", {
      value: `10 inbound-smtp.${cdk.Stack.of(this).region}.amazonaws.com`,
      description: "MX target to configure for the SES inbound email subdomain",
    });

    const customAuthDomainOutput = new cdk.CfnOutput(
      this,
      "CognitoCustomDomainCloudFront",
      {
        value: customHostedDomain.attrCloudFrontDistribution,
      }
    );
    customAuthDomainOutput.condition = useCustomDomain;

    const apiCustomDomainTarget = new cdk.CfnOutput(
      this,
      "ApiCustomDomainTarget",
      {
        value: apiDomain.domainNameAliasDomainName,
        description:
          "CNAME target for API custom domain. " +
          "Create a CNAME record in Cloudflare pointing to this value " +
          "(with Proxy disabled / grey cloud).",
      }
    );
    apiCustomDomainTarget.condition = useApiCustomDomain;

    const apiCustomDomainUrlOutput = new cdk.CfnOutput(
      this,
      "ApiCustomDomainUrl",
      {
        value: `https://${apiCustomDomainName.valueAsString}`,
        description: "The custom domain URL for the API.",
      }
    );
    apiCustomDomainUrlOutput.condition = useApiCustomDomain;

    cdk.Aspects.of(this).add(new CdkInternalLambdaCheckovSuppression());
  }
}

function resolveCorsAllowedOrigins(
  scope: Construct,
  requiredOrigins: string[]
): string[] {
  const contextOrigins = normalizeCorsOrigins(
    scope.node.tryGetContext("corsAllowedOrigins")
  );
  const envOrigins = normalizeCorsOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const configuredOrigins = [...contextOrigins, ...envOrigins];
  return ensureRequiredCorsOrigins(requiredOrigins, configuredOrigins);
}

function ensureRequiredCorsOrigins(
  requiredOrigins: string[],
  origins: string[]
): string[] {
  return Array.from(
    new Set(
      [...requiredOrigins, ...origins].map((origin) => origin.trim())
    )
  ).filter((origin) => origin.length > 0);
}

function normalizeCorsOrigins(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((origin) => `${origin}`.trim())
      .filter((origin) => origin.length > 0);
  }
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function buildCorsOriginOverrideTemplate(allowedOrigins: string[]): string {
  const conditions = allowedOrigins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) =>
      origin
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
    )
    .map((origin) => `$origin == "${origin}"`)
    .join(" || ");

  const allowlistCondition = conditions || "false";

  return [
    '#set($origin = $input.params().header.get("Origin"))',
    '#if($origin == "")',
    '  #set($origin = $input.params().header.get("origin"))',
    "#end",
    `#if(${allowlistCondition})`,
    "  #set($context.responseOverride.header.Access-Control-Allow-Origin = $origin)",
    "#end",
  ].join("\n");
}

function addCheckovMethodSuppression(
  method: apigateway.Method,
  id: string,
  comment: string
): void {
  const cfnMethod = method.node.defaultChild as apigateway.CfnMethod | undefined;
  cfnMethod?.addMetadata("checkov", { skip: [{ id, comment }] });
}

function parseOptionalPort(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid port value: ${value}`);
  }
  return parsed;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}`);
}

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "missing";
  }
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashDirectory(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    return "missing";
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(hashDirectory(fullPath));
    } else {
      files.push(hashFile(fullPath));
    }
  }

  return crypto.createHash("sha256").update(files.sort().join("")).digest("hex");
}
