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
    const lambdaFactory = new PythonLambdaFactory(this, {
      vpc,
      securityGroups: [lambdaSecurityGroup],
    });

    // Factory for Lambda functions that run outside VPC (for authorizers that
    // need to fetch JWKS from public Cognito endpoints)
    const noVpcLambdaFactory = new PythonLambdaFactory(this, {});

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

    // Client assets logging bucket
    const clientAssetsLogBucketName = [
      name("client-assets-logs"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    const clientAssetsLogBucket = new s3.Bucket(this, "ClientAssetsLogBucket", {
      bucketName: clientAssetsLogBucketName,
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

    const clientAssetsLogBucketCfn = clientAssetsLogBucket.node
      .defaultChild as s3.CfnBucket;
    clientAssetsLogBucketCfn.addMetadata("checkov", {
      skip: [
        {
          id: "CKV_AWS_18",
          comment:
            "Logging bucket - enabling access logging would create infinite loop",
        },
      ],
    });

    // Client assets bucket
    const clientAssetsBucketName = [
      name("client-assets"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    const clientAssetsBucket = new s3.Bucket(this, "ClientAssetsBucket", {
      bucketName: clientAssetsBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsBucket: clientAssetsLogBucket,
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
          "Custom domain for client-asset downloads (for example media.evolvesprouts.com).",
      }
    );
    const assetDownloadCustomDomainCertificateArn = new cdk.CfnParameter(
      this,
      "AssetDownloadCustomDomainCertificateArn",
      {
        type: "String",
        description:
          "ACM certificate ARN for the client-asset download custom domain (must be in us-east-1).",
      }
    );
    const assetDownloadWafWebAclArn = new cdk.CfnParameter(
      this,
      "AssetDownloadWafWebAclArn",
      {
        type: "String",
        default: "",
        description:
          "Optional WAF WebACL ARN for client-asset CloudFront protection (must be from us-east-1).",
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

    const assetDownloadPublicKey = new cloudfront.PublicKey(
      this,
      "AssetDownloadPublicKey",
      {
        encodedKey: assetDownloadCloudFrontPublicKeyPem.valueAsString,
        comment: "Public key for client asset CloudFront signed URLs.",
      }
    );
    const assetDownloadKeyGroup = new cloudfront.KeyGroup(
      this,
      "AssetDownloadKeyGroup",
      {
        items: [assetDownloadPublicKey],
        comment: "Trusted key group for client asset CloudFront signed URLs.",
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
        logBucket: clientAssetsLogBucket,
        logFilePrefix: "cloudfront-download-access-logs/",
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(clientAssetsBucket),
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
        DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
        DATABASE_NAME: "evolvesprouts",
        DATABASE_USERNAME: "evolvesprouts_admin",
        DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        CORS_ALLOWED_ORIGINS: corsAllowedOrigins.join(","),
        CLIENT_ASSETS_BUCKET_NAME: clientAssetsBucket.bucketName,
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
      },
    });
    database.grantAdminUserSecretRead(adminFunction);
    database.grantConnect(adminFunction, "evolvesprouts_admin");
    clientAssetsBucket.grantReadWrite(adminFunction);
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

    const sesSenderIdentityArn = cdk.Stack.of(this).formatArn({
      service: "ses",
      resource: "identity",
      resourceName: sesSenderEmail.valueAsString,
    });

    // -------------------------------------------------------------------------
    // Booking Request Messaging (SNS + SQS)
    // -------------------------------------------------------------------------

    const sqsEncryptionKey = new kms.Key(this, "SqsEncryptionKey", {
      enableKeyRotation: true,
      description: "KMS key for SQS queue encryption",
    });

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
    new apigateway.CfnAccount(this, "ApiGatewayAccount", {
      cloudWatchRoleArn: apiGatewayLogRole.roleArn,
    });

    // -------------------------------------------------------------------------
    // API Gateway access logs
    // SECURITY: Encrypted with KMS key (Checkov requirement)
    // -------------------------------------------------------------------------
    const apiAccessLogGroupName = name("api-access-logs");

    const apiLogEncryptionKey = new kms.Key(this, "ApiLogEncryptionKey", {
      enableKeyRotation: true,
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
        allowMethods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"],
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
      "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
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
      apiKeyName: name("public-www-key"),
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

    const secretsEncryptionKey = new kms.Key(this, "SecretsEncryptionKey", {
      enableKeyRotation: true,
      description: "KMS key for Secrets Manager encryption",
    });

    // SECURITY: Use customer-managed KMS key (Checkov CKV_AWS_149)
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

    new cdk.CfnOutput(this, "ClientAssetsBucketName", {
      value: clientAssetsBucket.bucketName,
    });

    new cdk.CfnOutput(this, "ClientAssetsLogBucketName", {
      value: clientAssetsLogBucket.bucketName,
    });
    new cdk.CfnOutput(this, "ClientAssetsDownloadDistributionDomain", {
      value: assetDownloadDistribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "ClientAssetsDownloadCloudFrontKeyPairId", {
      value: assetDownloadPublicKey.publicKeyId,
    });
    new cdk.CfnOutput(this, "ClientAssetsDownloadCustomDomainTarget", {
      value: assetDownloadDistribution.distributionDomainName,
      description:
        "CNAME target for the client-asset download custom domain in DNS.",
    });
    new cdk.CfnOutput(this, "ClientAssetsDownloadCustomDomainUrl", {
      value: `https://${assetDownloadCustomDomainName.valueAsString}`,
      description: "Client-asset download custom domain URL.",
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
