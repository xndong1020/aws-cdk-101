#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
// import { CdkWorkshopStack } from "../lib/fargate-service-stack";
// import { VpcAlbAsgStack } from "../lib/VpcAlbAsgStack";
// import { StepfunctionsLambdaStack } from "../lib/stepfunctions-lambda";
import { CdkFargateCloudMapStack } from '../lib/fargate-cloud-map'

const app = new cdk.App();
new CdkFargateCloudMapStack(app, "CdkFargateCloudMapStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
