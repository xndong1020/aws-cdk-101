import * as cdk from "@aws-cdk/core";
import ecs = require("@aws-cdk/aws-ecs");
import ecs_patterns = require("@aws-cdk/aws-ecs-patterns");
import ec2 = require("@aws-cdk/aws-ec2");

export class CdkWorkshopStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a cluster
    const vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, "fargate-service-autoscaling", {
      vpc,
    });

    // Create Fargate Service
    const loadBalancedFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "sample-app",
      {
        cluster,
        serviceName: "sample-app-fargate-service",
        memoryLimitMiB: 1024,
        cpu: 512,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
        },
      }
    );

    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/",
    });

    // Setup AutoScaling policy
    const scaling = loadBalancedFargateService.service.autoScaleTaskCount({
      minCapacity: 1, // default is 1,
      maxCapacity: 3,
    });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: loadBalancedFargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}
