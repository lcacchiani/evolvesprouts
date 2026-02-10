import * as cdk from "aws-cdk-lib";
import { CrmWebStack } from '../lib/crm-web-stack';
import { PublicWwwStack } from '../lib/public-www-stack';
import { WafStack } from '../lib/waf-stack';

const app = new cdk.App();

const bootstrapQualifier = process.env.CDK_BOOTSTRAP_QUALIFIER;
if (bootstrapQualifier) {
  app.node.setContext("@aws-cdk/core:bootstrapQualifier", bootstrapQualifier);
}

new CrmWebStack(app, 'evolvesprouts-crm-web', {
  description: 'Evolve Sprouts CRM Web',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  synthesizer: bootstrapQualifier
    ? new cdk.DefaultStackSynthesizer({ qualifier: bootstrapQualifier })
    : undefined
});

new PublicWwwStack(app, 'evolvesprouts-public-www', {
  description: 'Evolve Sprouts Public Website',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  synthesizer: bootstrapQualifier
    ? new cdk.DefaultStackSynthesizer({ qualifier: bootstrapQualifier })
    : undefined
});

new WafStack(app, 'evolvesprouts-waf', {
  description: 'Evolve Sprouts WAF for CloudFront (us-east-1)',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  synthesizer: bootstrapQualifier
    ? new cdk.DefaultStackSynthesizer({ qualifier: bootstrapQualifier })
    : undefined,
  crossRegionReferences: true,
});
