#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsCdk101Stack } from '../lib/aws-cdk-101-stack';

const app = new cdk.App();
new AwsCdk101Stack(app, 'AwsCdk101Stack');
