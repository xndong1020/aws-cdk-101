import * as cdk from "@aws-cdk/core";
import ecs = require("@aws-cdk/aws-ecs");
import servicediscovery = require("@aws-cdk/aws-servicediscovery")
import ec2 = require("@aws-cdk/aws-ec2");
import { Duration } from "@aws-cdk/core";
import { NetworkMode } from "@aws-cdk/aws-ecs";
import { SecurityGroup } from "@aws-cdk/aws-ec2";
import { Role } from "@aws-cdk/aws-iam";

export class CdkFargateCloudMapStack extends cdk.Stack {
  private readonly SERVICE_CONNECT_WORKER_NAME = 'connect-worker'
  private readonly SERVICE_CONNECT_UI_NAME = 'connect-ui'
  private readonly PRIVATE_DNS_NAMESPACE = 'portal-ecs-services.local'

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // use exisiting Vpc
    const vpc = ec2.Vpc.fromLookup(this, "vpc", {
      vpcId: "vpc-f4063593",
    });

    // Cloud Map Private DNS Namespace
    // supports both API calls and DNS queries within a vpc
    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'PortalEcsNamespace', {
      name: this.PRIVATE_DNS_NAMESPACE,
      vpc,
    });

    // ECS Cluster to host ecs services
    const cluster = new ecs.Cluster(this, 'PortalEcsCluster', { vpc, clusterName: "portal-service-ecs-cluster" });

    // add asg
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      minCapacity: 1,
      maxCapacity: 1
    });


    // create task defination
    const connectWorkerTaskDefinition = new ecs.TaskDefinition(this, 'connectWorkerTaskDef', {
      memoryMiB: '512',
      cpu: '256',
      taskRole: Role.fromRoleArn(this, 'connectWorkerTasktionRole', 'arn:aws:iam::476287388771:role/ecsTaskExecutionRole'),
      executionRole: Role.fromRoleArn(this, 'connectWorkerExecutionRole', 'arn:aws:iam::476287388771:role/ecsTaskExecutionRole'),
      family: 'connectWorkerTaskDefinition',
      networkMode: NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.FARGATE
    });

    //  create container defination
    const connectWorkerContainer = connectWorkerTaskDefinition.addContainer('connect-worker-container', {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      memoryLimitMiB: 256,
      environment: {
        STAGE: 'dev',
      },
    });

    connectWorkerContainer.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP
    })

    // create task defination
    const connectUiTaskDefinition = new ecs.TaskDefinition(this, 'connectUiTaskDef', {
      memoryMiB: '512',
      cpu: '256',
      taskRole: Role.fromRoleArn(this, 'connectUiTaskRole', 'arn:aws:iam::476287388771:role/ecsTaskExecutionRole'),
      executionRole: Role.fromRoleArn(this, 'connectUiExecutionRole', 'arn:aws:iam::476287388771:role/ecsTaskExecutionRole'),
      family: 'connectUiTaskDefinition',
      networkMode: NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.FARGATE
    });

    //  create container defination
    const connectUiContainer = connectUiTaskDefinition.addContainer('connect-ui-container', {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      memoryLimitMiB: 256,
      environment: { // clear text, not for sensitive data
        STAGE: 'dev',
        CONNECT_URL: `${this.SERVICE_CONNECT_WORKER_NAME}.${this.PRIVATE_DNS_NAMESPACE}`
      },
    });

    connectUiContainer.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP
    })

    const ecsService01 = new ecs.FargateService(this, "ConnectWorkerECSService", {
      serviceName: this.SERVICE_CONNECT_WORKER_NAME,
      cluster,
      taskDefinition: connectWorkerTaskDefinition,
      enableECSManagedTags: true,
      desiredCount: 1,
      securityGroups: [SecurityGroup.fromSecurityGroupId(this, 'ecs-nginx-01', 'sg-0f9a422c01115113a')],
      cloudMapOptions: {
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.minutes(5),
        name: this.SERVICE_CONNECT_WORKER_NAME,
        cloudMapNamespace: namespace
      }
    });

    const ecsService02 = new ecs.FargateService(this, "ConnectUIECSService", {
      serviceName: this.SERVICE_CONNECT_UI_NAME,
      cluster,
      taskDefinition: connectUiTaskDefinition,
      enableECSManagedTags: true,
      desiredCount: 1,
      securityGroups: [SecurityGroup.fromSecurityGroupId(this, 'ecs-nginx-02', 'sg-0f9a422c01115113a')],
      cloudMapOptions: {
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.minutes(5),
        name: this.SERVICE_CONNECT_UI_NAME,
        cloudMapNamespace: namespace
      }
    });
  }
}
