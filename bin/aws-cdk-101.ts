#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { CdkWorkshopStack } from "../lib/fargate-service-stack";

const app = new cdk.App();
new CdkWorkshopStack(app, "CdkWorkshopStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
