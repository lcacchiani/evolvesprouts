import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

export interface ApiAdminCrmStackProps extends cdk.NestedStackProps {
  restApi: apigateway.IRestApi;
  adminResource: apigateway.IResource;
  adminIntegration: apigateway.Integration;
  adminAuthorizer: apigateway.IAuthorizer;
}

/**
 * Admin CRM routes (`/v1/admin/contacts/**`, `/families/**`, `/organizations/**`) in a
 * nested stack to keep the parent ApiStack under CloudFormation's 500-resource quota.
 */
export class ApiAdminCrmStack extends cdk.NestedStack {
  public constructor(scope: Construct, id: string, props: ApiAdminCrmStackProps) {
    super(scope, id, props);

    const { restApi, adminResource, adminIntegration, adminAuthorizer } = props;

    const adminAttach = apigateway.Resource.fromResourceAttributes(this, "AdminRouteParent", {
      restApi,
      resourceId: adminResource.resourceId,
      path: adminResource.path,
    });

    // Admin CRM contacts / families / organizations (non-vendor)
    const adminContacts = adminAttach.addResource("contacts");
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
    adminContactById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminContactNotes = adminContactById.addResource("notes");
    adminContactNotes.addMethod("GET", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminContactNotes.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminContactNoteById = adminContactNotes.addResource("{noteId}");
    adminContactNoteById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminContactNoteById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminFamilies = adminAttach.addResource("families");
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
    adminFamilyById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminFamilyMembers = adminFamilyById.addResource("members");
    adminFamilyMembers.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminFamilyMemberById = adminFamilyMembers.addResource("{memberId}");
    adminFamilyMemberById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminFamilyMemberById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });

    const adminOrganizationsCrm = adminAttach.addResource("organizations");
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
    adminOrganizationCrmById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminOrganizationCrmMembers = adminOrganizationCrmById.addResource("members");
    adminOrganizationCrmMembers.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    const adminOrganizationCrmMemberById = adminOrganizationCrmMembers.addResource("{memberId}");
    adminOrganizationCrmMemberById.addMethod("PATCH", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
    adminOrganizationCrmMemberById.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: adminAuthorizer,
    });
  }
}
