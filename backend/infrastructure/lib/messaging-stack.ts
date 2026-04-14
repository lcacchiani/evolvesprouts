import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";
import { hashDirectory } from "./cdk-source-hash";
import { PythonLambdaFactory } from "./constructs";

export interface MessagingNestedStackProps extends cdk.NestedStackProps {
  resourcePrefix: string;
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  sharedLambdaEnvEncryptionKey: kms.IKey;
  sharedLambdaLogEncryptionKey: kms.IKey;
  sharedLambdaDlq: sqs.IQueue;
  sqsEncryptionKey: kms.IKey;
  databaseSecretArn: string;
  databaseProxyEndpoint: string;
  awsProxyFunctionArn: string;
  cognitoUserPoolId: string;
  adminGroupName: string;
  sesSenderIdentityArn: string;
  sesSenderDomainIdentityArn: string;
  sesAuthEmailIdentityArn: string;
  sesAuthEmailDomainIdentityArn: string;
  mailchimpApiSecretArn: string;
  assetsBucketName: string;
  assetsBucketArn: string;
  openrouterApiSecretArn: string;
  databaseProxyArn: string;
  databaseSecretKmsKeyArn: string;
  sesSenderEmail: string;
  authEmailFromAddress: string;
  mailchimpListId: string;
  mailchimpServerPrefix: string;
  mediaDefaultResourceKey: string;
  assetDownloadCustomDomainName: string;
  publicWwwDomainName: string;
  publicWwwStagingDomainName: string;
  publicWwwInstagramUrl: string;
  publicWwwLinkedinUrl: string;
  publicWwwWhatsappUrl: string;
  publicWwwBusinessPhoneNumber: string;
  mailchimpMediaDownloadMergeTag: string;
  mailchimpFreeResourceJourneyId: string;
  mailchimpFreeResourceJourneyStepId: string;
  mailchimpRequireMarketingConsent: string;
  mailchimpWelcomeJourneyId: string;
  mailchimpWelcomeJourneyStepId: string;
  openrouterChatCompletionsUrl: string;
  openrouterModel: string;
  openrouterMaxFileBytes: string;
  /** IANA timezone id for SALES_RECAP_DISPLAY_TIMEZONE (empty = app default). */
  salesRecapDisplayTimezone: string;
}

/**
 * SNS/SQS messaging pipelines and SES template deployment, isolated in a nested
 * stack to keep the root CloudFormation stack under the 500-resource limit.
 */
export class MessagingNestedStack extends cdk.NestedStack {
  public readonly mediaTopic: sns.Topic;
  public readonly mediaQueue: sqs.Queue;
  public readonly mediaDLQ: sqs.Queue;
  public readonly mediaRequestProcessor: lambda.Function;

  public readonly expenseParserTopic: sns.Topic;
  public readonly expenseParserQueue: sqs.Queue;
  public readonly expenseParserDLQ: sqs.Queue;
  public readonly expenseParserFunction: lambda.Function;

  public constructor(scope: Construct, id: string, props: MessagingNestedStackProps) {
    super(scope, id, props);

    const name = (suffix: string) => `${props.resourcePrefix}-${suffix}`;

    const lambdaFactory = new PythonLambdaFactory(this, {
      vpc: props.vpc,
      securityGroups: [props.lambdaSecurityGroup],
      environmentEncryptionKey: props.sharedLambdaEnvEncryptionKey,
      logEncryptionKey: props.sharedLambdaLogEncryptionKey,
      deadLetterQueue: props.sharedLambdaDlq,
    });

    const noVpcLambdaFactory = new PythonLambdaFactory(this, {
      environmentEncryptionKey: props.sharedLambdaEnvEncryptionKey,
      logEncryptionKey: props.sharedLambdaLogEncryptionKey,
      deadLetterQueue: props.sharedLambdaDlq,
    });

    const createPythonFunction = (
      id: string,
      opts: {
        handler: string;
        environment?: Record<string, string>;
        timeout?: cdk.Duration;
        memorySize?: number;
        noVpc?: boolean;
        manageLogGroup?: boolean;
        reservedConcurrentExecutions?: number;
      }
    ) => {
      const f = opts.noVpc ? noVpcLambdaFactory : lambdaFactory;
      return f.create(id, {
        functionName: name(id),
        handler: opts.handler,
        environment: opts.environment,
        timeout: opts.timeout,
        memorySize: opts.memorySize,
        securityGroups: opts.noVpc ? undefined : [props.lambdaSecurityGroup],
        manageLogGroup: opts.manageLogGroup,
        reservedConcurrentExecutions: opts.reservedConcurrentExecutions,
      }).function;
    };

    const sesTemplateManagerFunction = createPythonFunction("SesTemplateManagerFunction", {
        handler: "lambda/ses_template_manager/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(60),
        noVpc: true,
        manageLogGroup: false,
        reservedConcurrentExecutions: -1,
      });
    sesTemplateManagerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ses:CreateTemplate",
          "ses:UpdateTemplate",
          "ses:DeleteTemplate",
          "ses:GetTemplate",
        ],
        resources: ["*"],
      })
    );
    const sesTemplatesHash = hashDirectory(
      path.join(__dirname, "../../src/app/templates/ses")
    );
    const sesHandlerHash = hashDirectory(
      path.join(__dirname, "../../lambda/ses_template_manager")
    );
    new cdk.CustomResource(this, "SesEmailTemplates", {
      serviceToken: sesTemplateManagerFunction.functionArn,
      properties: {
        TemplatesHash: sesTemplatesHash,
        HandlerHash: sesHandlerHash,
      },
    });

    // -------------------------------------------------------------------------
    // Media Request Messaging (SNS + SQS)
    // -------------------------------------------------------------------------

    this.mediaDLQ = new sqs.Queue(this, "MediaDLQ", {
      queueName: name("media-dlq"),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.sqsEncryptionKey,
    });

    this.mediaQueue = new sqs.Queue(this, "MediaQueue", {
      queueName: name("media-queue"),
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: this.mediaDLQ,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.sqsEncryptionKey,
    });

    this.mediaTopic = new sns.Topic(this, "MediaTopic", {
      topicName: name("media-events"),
      masterKey: props.sqsEncryptionKey,
    });

    this.mediaTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(this.mediaQueue)
    );

    this.mediaRequestProcessor = createPythonFunction("MediaRequestProcessor", {
        handler: "lambda/media_processor/handler.lambda_handler",
        timeout: cdk.Duration.seconds(30),
        manageLogGroup: false,
        environment: {
          DATABASE_SECRET_ARN: props.databaseSecretArn,
          DATABASE_NAME: "evolvesprouts",
          DATABASE_USERNAME: "evolvesprouts_admin",
          DATABASE_PROXY_ENDPOINT: props.databaseProxyEndpoint,
          DATABASE_IAM_AUTH: "true",
          SES_SENDER_EMAIL: props.sesSenderEmail,
          SALES_RECAP_DISPLAY_TIMEZONE: props.salesRecapDisplayTimezone,
          COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
          ADMIN_GROUP: props.adminGroupName,
          AWS_PROXY_FUNCTION_ARN: props.awsProxyFunctionArn,
          MAILCHIMP_API_SECRET_ARN: props.mailchimpApiSecretArn,
          MAILCHIMP_LIST_ID: props.mailchimpListId,
          MAILCHIMP_SERVER_PREFIX: props.mailchimpServerPrefix,
          MEDIA_DEFAULT_RESOURCE_KEY: props.mediaDefaultResourceKey,
          ASSET_SHARE_LINK_BASE_URL: `https://${props.assetDownloadCustomDomainName}`,
          ASSET_SHARE_LINK_DEFAULT_ALLOWED_DOMAINS:
            `${props.publicWwwDomainName},${props.publicWwwStagingDomainName}`,
          MAILCHIMP_MEDIA_DOWNLOAD_MERGE_TAG: props.mailchimpMediaDownloadMergeTag,
          MAILCHIMP_FREE_RESOURCE_JOURNEY_ID: props.mailchimpFreeResourceJourneyId,
          MAILCHIMP_FREE_RESOURCE_JOURNEY_STEP_ID:
            props.mailchimpFreeResourceJourneyStepId,
          CONFIRMATION_EMAIL_FROM_ADDRESS: props.authEmailFromAddress,
          MAILCHIMP_REQUIRE_MARKETING_CONSENT: props.mailchimpRequireMarketingConsent,
          MAILCHIMP_WELCOME_JOURNEY_ID: props.mailchimpWelcomeJourneyId,
          MAILCHIMP_WELCOME_JOURNEY_STEP_ID: props.mailchimpWelcomeJourneyStepId,
          PUBLIC_WWW_BASE_URL: `https://${props.publicWwwDomainName}`,
          PUBLIC_WWW_INSTAGRAM_URL: props.publicWwwInstagramUrl,
          PUBLIC_WWW_LINKEDIN_URL: props.publicWwwLinkedinUrl,
          PUBLIC_WWW_WHATSAPP_URL: props.publicWwwWhatsappUrl,
          PUBLIC_WWW_BUSINESS_PHONE_NUMBER: props.publicWwwBusinessPhoneNumber,
        },
      });

    this.mediaRequestProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
        resources: [
          props.sesSenderIdentityArn,
          props.sesSenderDomainIdentityArn,
          props.sesAuthEmailIdentityArn,
          props.sesAuthEmailDomainIdentityArn,
          cdk.Arn.format(
            { service: "ses", resource: "template", resourceName: "evolvesprouts-*" },
            cdk.Stack.of(this)
          ),
        ],
      })
    );
    this.mediaRequestProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [props.awsProxyFunctionArn],
      })
    );
    this.mediaRequestProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
        resources: [props.databaseSecretArn, props.mailchimpApiSecretArn],
      })
    );
    if (props.databaseSecretKmsKeyArn) {
      this.mediaRequestProcessor.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["kms:Decrypt"],
          resources: [props.databaseSecretKmsKeyArn],
        })
      );
    }
    this.mediaRequestProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rds-db:connect"],
        resources: [
          cdk.Fn.join("", [
            "arn:", cdk.Aws.PARTITION, ":rds-db:", cdk.Aws.REGION, ":", cdk.Aws.ACCOUNT_ID,
            ":dbuser:", cdk.Fn.select(6, cdk.Fn.split(":", props.databaseProxyArn)),
            "/evolvesprouts_admin",
          ]),
        ],
      })
    );

    this.mediaRequestProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(this.mediaQueue, {
        batchSize: 1,
      })
    );

    new cdk.aws_cloudwatch.Alarm(this, "MediaDLQAlarm", {
      alarmName: name("media-dlq-alarm"),
      alarmDescription:
        "Media request messages failed processing and landed in DLQ",
      metric: this.mediaDLQ.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // -------------------------------------------------------------------------
    // Expense Parser Messaging (SNS + SQS)
    // -------------------------------------------------------------------------

    this.expenseParserDLQ = new sqs.Queue(this, "ExpenseParserDLQ", {
      queueName: name("expense-parser-dlq"),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.sqsEncryptionKey,
    });

    this.expenseParserQueue = new sqs.Queue(this, "ExpenseParserQueue", {
      queueName: name("expense-parser-queue"),
      visibilityTimeout: cdk.Duration.seconds(180),
      deadLetterQueue: {
        queue: this.expenseParserDLQ,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.sqsEncryptionKey,
    });

    this.expenseParserTopic = new sns.Topic(this, "ExpenseParserTopic", {
      topicName: name("expense-parser-events"),
      masterKey: props.sqsEncryptionKey,
    });
    this.expenseParserTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(this.expenseParserQueue)
    );

    this.expenseParserFunction = createPythonFunction("ExpenseParserFunction", {
        handler: "lambda/expense_parser/handler.lambda_handler",
        timeout: cdk.Duration.seconds(90),
        manageLogGroup: false,
        environment: {
          DATABASE_SECRET_ARN: props.databaseSecretArn,
          DATABASE_NAME: "evolvesprouts",
          DATABASE_USERNAME: "evolvesprouts_admin",
          DATABASE_PROXY_ENDPOINT: props.databaseProxyEndpoint,
          DATABASE_IAM_AUTH: "true",
          ASSETS_BUCKET_NAME: props.assetsBucketName,
          OPENROUTER_API_KEY_SECRET_ARN: props.openrouterApiSecretArn,
          OPENROUTER_CHAT_COMPLETIONS_URL: props.openrouterChatCompletionsUrl,
          OPENROUTER_MODEL: props.openrouterModel,
          OPENROUTER_MAX_FILE_BYTES: props.openrouterMaxFileBytes,
          AWS_PROXY_FUNCTION_ARN: props.awsProxyFunctionArn,
        },
      });

    this.expenseParserFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
        resources: [props.databaseSecretArn, props.openrouterApiSecretArn],
      })
    );
    if (props.databaseSecretKmsKeyArn) {
      this.expenseParserFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["kms:Decrypt"],
          resources: [props.databaseSecretKmsKeyArn],
        })
      );
    }
    this.expenseParserFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rds-db:connect"],
        resources: [
          cdk.Fn.join("", [
            "arn:", cdk.Aws.PARTITION, ":rds-db:", cdk.Aws.REGION, ":", cdk.Aws.ACCOUNT_ID,
            ":dbuser:", cdk.Fn.select(6, cdk.Fn.split(":", props.databaseProxyArn)),
            "/evolvesprouts_admin",
          ]),
        ],
      })
    );
    this.expenseParserFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:GetBucketLocation", "s3:ListBucket"],
        resources: [props.assetsBucketArn, `${props.assetsBucketArn}/*`],
      })
    );
    this.expenseParserFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [props.awsProxyFunctionArn],
      })
    );

    this.expenseParserFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.expenseParserQueue, {
        batchSize: 1,
      })
    );

    new cdk.aws_cloudwatch.Alarm(this, "ExpenseParserDLQAlarm", {
      alarmName: name("expense-parser-dlq-alarm"),
      alarmDescription:
        "Expense parser messages failed processing and landed in DLQ",
      metric: this.expenseParserDLQ.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
