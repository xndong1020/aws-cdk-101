#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
// import { CdkWorkshopStack } from "../lib/fargate-service-stack";
// import { VpcAlbAsgStack } from "../lib/VpcAlbAsgStack";
import { VpcAlbAsgStack } from "../lib/VpcAlbAsgStack";

const app = new cdk.App();
new VpcAlbAsgStack(app, "VpcAlbAsgStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
