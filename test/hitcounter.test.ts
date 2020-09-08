import { expect as expectCDK, haveResource } from "@aws-cdk/assert";
import cdk = require("@aws-cdk/core");
import * as lambda from "@aws-cdk/aws-lambda";

import { HitCounter } from "../lib/hitcounter";

describe(`Test "hitcounter" stack`, () => {
  const stack = new cdk.Stack();
  // WHEN
  new HitCounter(stack, "MyTestConstruct", {
    downstream: new lambda.Function(stack, "TestFunction", {
      functionName: "TestFunction",
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: "lambda.handler",
      code: lambda.Code.inline("test"),
    }),
  });

  it("Should have a dynamoDB resource", () => {
    expectCDK(stack).to(haveResource("AWS::DynamoDB::Table"));
  });

  it("Should have a lambda function with correct env variables", () => {
    expectCDK(stack).to(
      haveResource("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            DOWNSTREAM_FUNCTION_NAME: { Ref: "TestFunction22AD90FC" },
            HITS_TABLE_NAME: { Ref: "MyTestConstructnicoleHitsDBE8AD747A" },
          },
        },
      })
    );
  });
});
