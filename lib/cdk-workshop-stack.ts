import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as apigw from "@aws-cdk/aws-apigateway";
import { HitCounter } from "./hitcounter";

export class CdkWorkshopStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // defines an AWS Lambda resource
    const hello = new lambda.Function(this, "HelloHandler", {
      functionName: "HelloHandler",
      runtime: lambda.Runtime.NODEJS_12_X, // execution environment
      code: lambda.Code.fromAsset("lambda"), // code loaded from "lambda" directory
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      handler: "hello.handler", // file is "hello", function is "handler"
    });

    // now the "HelloHandler" is the downstream function of "HelloHitCounter",
    // when user calls the "HelloHitCounter" function, the downstream lambda function
    // "HelloHandler" is also executed
    const helloWithCounter = new HitCounter(this, "HelloHitCounter", {
      downstream: hello,
    });

    // defines an API Gateway REST API resource backed by our "hello" function.
    new apigw.LambdaRestApi(this, "NicoleEndpoint", {
      restApiName: "NicoleEndpoint",
      deployOptions: {
        stageName: "dev",
        metricsEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      handler: helloWithCounter.handler,
    });
  }
}
