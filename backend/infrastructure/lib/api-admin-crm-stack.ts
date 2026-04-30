import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

export interface ApiAdminCrmStackProps extends cdk.NestedStackProps {
  restApi: apigateway.IRestApi;
  /** The `/v1/admin/contacts` resource created in the parent stack. */
  contactsResource: apigateway.IResource;
  /** The `/v1/admin/families` resource created in the parent stack. */
  familiesResource: apigateway.IResource;
  /** The `/v1/admin/organizations` resource created in the parent stack. */
  organizationsResource: apigateway.IResource;
  adminIntegration: apigateway.Integration;
  adminAuthorizer: apigateway.IAuthorizer;
}

/**
 * Admin CRM methods and sub-resources (`/v1/admin/contacts/**`, `/families/**`,
 * `/organizations/**`) in a nested stack to keep the parent ApiStack under
 * CloudFormation's 500-resource quota.
 *
 * The top-level `contacts`, `families`, and `organizations` resources live in the parent
 * stack so their CloudFormation logical IDs are stable across the migration from inline
 * routes to a nested stack.
 */
export class ApiAdminCrmStack extends cdk.NestedStack {
  public constructor(scope: Construct, id: string, props: ApiAdminCrmStackProps) {
    super(scope, id, props);

    const {
      restApi,
      contactsResource,
      familiesResource,
      organizationsResource,
      adminIntegration,
      adminAuthorizer,
    } = props;

    this.wireContacts(restApi, contactsResource, adminIntegration, adminAuthorizer);
    this.wireFamilies(restApi, familiesResource, adminIntegration, adminAuthorizer);
    this.wireOrganizations(restApi, organizationsResource, adminIntegration, adminAuthorizer);
  }

  private wireContacts(
    restApi: apigateway.IRestApi,
    contactsResource: apigateway.IResource,
    adminIntegration: apigateway.Integration,
    adminAuthorizer: apigateway.IAuthorizer,
  ): void {
    const adminContacts = apigateway.Resource.fromResourceAttributes(
      this,
      "ContactsRouteParent",
      {
        restApi,
        resourceId: contactsResource.resourceId,
        path: contactsResource.path,
      },
    );

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
  }

  private wireFamilies(
    restApi: apigateway.IRestApi,
    familiesResource: apigateway.IResource,
    adminIntegration: apigateway.Integration,
    adminAuthorizer: apigateway.IAuthorizer,
  ): void {
    const adminFamilies = apigateway.Resource.fromResourceAttributes(
      this,
      "FamiliesRouteParent",
      {
        restApi,
        resourceId: familiesResource.resourceId,
        path: familiesResource.path,
      },
    );

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
  }

  private wireOrganizations(
    restApi: apigateway.IRestApi,
    organizationsResource: apigateway.IResource,
    adminIntegration: apigateway.Integration,
    adminAuthorizer: apigateway.IAuthorizer,
  ): void {
    const adminOrganizationsCrm = apigateway.Resource.fromResourceAttributes(
      this,
      "OrganizationsRouteParent",
      {
        restApi,
        resourceId: organizationsResource.resourceId,
        path: organizationsResource.path,
      },
    );

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
