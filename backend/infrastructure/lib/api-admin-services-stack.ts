import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

export interface ApiAdminServicesStackProps extends cdk.NestedStackProps {
  restApi: apigateway.IRestApi;
  /** The `/v1/admin/services` resource created in the parent stack. */
  servicesResource: apigateway.IResource;
  adminIntegration: apigateway.Integration;
  adminAuthorizer: apigateway.IAuthorizer;
}

/**
 * `/v1/admin/services/**` API Gateway methods and sub-resources (nested stack) to keep the
 * parent ApiStack under CloudFormation's 500-resource quota.
 *
 * The top-level `services` resource lives in the parent stack so its CloudFormation logical
 * ID is stable across the migration from inline routes to a nested stack.
 */
export class ApiAdminServicesStack extends cdk.NestedStack {
  public constructor(scope: Construct, id: string, props: ApiAdminServicesStackProps) {
    super(scope, id, props);

    const { restApi, servicesResource, adminIntegration, adminAuthorizer } = props;

    const adminServices = apigateway.Resource.fromResourceAttributes(
      this,
      "ServicesRouteParent",
      {
        restApi,
        resourceId: servicesResource.resourceId,
        path: servicesResource.path,
      },
    );

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

    const adminServiceDiscountCodeUsageSummary = adminServiceById.addResource(
      "discount-code-usage-summary",
    );
    adminServiceDiscountCodeUsageSummary.addMethod("GET", adminIntegration, {
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
  }
}
