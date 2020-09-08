#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { CdkWorkshopStack } from "../lib/fargate-service-stack";

const app = new cdk.App();
new CdkWorkshopStack(app, "CdkWorkshopStack");
