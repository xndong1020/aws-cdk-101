import * as cdk from "@aws-cdk/core";
import * as sfn from "@aws-cdk/aws-stepfunctions";
import * as tasks from "@aws-cdk/aws-stepfunctions-tasks";
import * as lambda from "@aws-cdk/aws-lambda";
import { Construct, StackProps, Duration, Stack } from "@aws-cdk/core";
import { PolicyStatement } from "@aws-cdk/aws-iam";

//
// The stack for this demo
//
export class StepfunctionsLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const submitLambda = new lambda.Function(this, "SubmitLambda", {
      functionName: "submitLambda",
      runtime: lambda.Runtime.NODEJS_12_X, // execution environment
      code: lambda.Code.fromAsset("lambda"), // code loaded from "lambda" directory
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      handler: "submitLambda.handler", // file is "submitLambda", function is "handler"
    });

    const finalStatusLambda = new lambda.Function(this, "finalStatus", {
      functionName: "finalStatusLambda",
      runtime: lambda.Runtime.NODEJS_12_X, // execution environment
      code: lambda.Code.fromAsset("lambda"), // code loaded from "lambda" directory
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      handler: "finalStatus.handler", // file is "finalStatus", function is "handler"
    });

    // allow `submitLambda` lambda function to send taskResponse to stateMachine
    submitLambda.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "states:SendTaskSuccess",
          "states:SendTaskFailure",
          "states:SendTaskHeartbeat",
        ],
        resources: ["arn:aws:states:*:*:*"],
      })
    );

    const submitJob = new tasks.LambdaInvoke(this, "Submit Job", {
      lambdaFunction: submitLambda,
      // Lambda's result is in the attribute `Payload`
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      // Pass just the field named "guid" into the Lambda, put the
      // Lambda's result in a field called "status" in the response
      payload: sfn.TaskInput.fromObject({
        token: sfn.JsonPath.taskToken,
        input: sfn.JsonPath.stringAt("$"),
      }),
      outputPath: "$",
    });

    const waitX = new sfn.Wait(this, "Wait X Seconds", {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(5)),
    });

    const jobFailed = new sfn.Fail(this, "Job Failed", {
      cause: "AWS Batch Job Failed",
      error: "DescribeJob returned FAILED",
    });

    const finalStatus = new tasks.LambdaInvoke(this, "Get Final Job Status", {
      lambdaFunction: finalStatusLambda,

      // inputPath: "$",
      // outputPath: "$",
    });

    const definition = submitJob.next(
      new sfn.Choice(this, "Job Complete?")
        // Look at the "status" field
        .when(sfn.Condition.stringEquals("$.status", "FAILED"), jobFailed)
        .when(sfn.Condition.stringEquals("$.status", "SUCCEEDED"), finalStatus)
        .otherwise(waitX)
    );

    new sfn.StateMachine(this, "StateMachine", {
      definition,
      timeout: Duration.minutes(5),
    });
  }
}
