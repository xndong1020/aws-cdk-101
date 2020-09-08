import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import { PolicyStatement, Role } from "@aws-cdk/aws-iam";

export interface HitCounterProps {
  /** a lambda function for which we want to count url hits **/
  downstream: lambda.IFunction;
}

export class HitCounter extends cdk.Construct {
  /** allows accessing the counter function */
  public readonly handler: lambda.Function;

  constructor(scope: cdk.Construct, id: string, props: HitCounterProps) {
    super(scope, id);

    const table = new dynamodb.Table(this, "nicoleHitsDB", {
      tableName: "nicoleHitsDB",
      partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    });

    this.handler = new lambda.Function(this, "HitCounterHandler", {
      functionName: "HitCounterHandler",
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "hitcounter.handler",
      code: lambda.Code.fromAsset("lambda"),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      environment: {
        DOWNSTREAM_FUNCTION_NAME: props.downstream.functionName,
        HITS_TABLE_NAME: table.tableName,
      },
    });
  }
}
