import * as cdk from "@aws-cdk/core";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as servicediscovery from "@aws-cdk/aws-servicediscovery";
import { Duration } from "@aws-cdk/core";
import { SecurityGroup } from "@aws-cdk/aws-ec2";
import { Role } from "@aws-cdk/aws-iam";
import { LogGroup } from "@aws-cdk/aws-logs";

export class EcsConnectService extends cdk.Stack {
  private readonly SERVICE_CONNECT_WORKER_NAME = "connect-worker";
  private readonly SERVICE_CONNECT_UI_NAME = "connect-ui";
  private readonly PRIVATE_DNS_NAMESPACE = "portal-kafka-ecs-service-discovery.local";
  private readonly APRA_VPC_DEV = "<your_vpc>";
  private readonly ELASTICSEARCH_POC_SG = "<your_security_group>";
  private readonly ECS_TASK_EXECUTION_ROLE = "<your_task_execution_role>";
  private readonly CLOUD_WATCH_LOG_GROUP_ARN = "<your_log_group_arn>"

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // use existing Vpc
    const vpc = ec2.Vpc.fromLookup(this, "apra-vpc", {
      vpcId: this.APRA_VPC_DEV
    });

    // Cloud Map Private DNS Namespace
    // supports both API calls and DNS queries within a vpc
    const namespace = new servicediscovery.PrivateDnsNamespace(this, "PortalEcsServiceNamespace", {
      name: this.PRIVATE_DNS_NAMESPACE,
      vpc
    });

    // ECS Cluster to host ecs services
    const cluster = new ecs.Cluster(this, "PortalEcsCluster", {
      vpc,
      clusterName: "portal-service-ecs-cluster"
    });

    // add asg
    cluster.addCapacity("DefaultAutoScalingGroup", {
      instanceType: new ec2.InstanceType("m5.large"),
      minCapacity: 1,
      maxCapacity: 1
    });

    // create task definition for connect worker
    const connectWorkerTaskDefinition = new ecs.TaskDefinition(this, "connectWorkerTaskDef", {
      memoryMiB: "2048",
      cpu: "512",
      taskRole: Role.fromRoleArn(this, "connectWorkerTaskRole", this.ECS_TASK_EXECUTION_ROLE),
      executionRole: Role.fromRoleArn(
        this,
        "connectWorkerExecutionRole",
        this.ECS_TASK_EXECUTION_ROLE
      ),
      family: "connectWorkerTaskDefinition",
      networkMode: ecs.NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.FARGATE
    });

    //  create container definition for connect worker
    const connectWorkerContainer = connectWorkerTaskDefinition.addContainer(
      "connect-worker-container",
      {
        image: ecs.ContainerImage.fromRegistry("debezium/connect:1.3"),
        logging: new ecs.AwsLogDriver({
          logGroup: LogGroup.fromLogGroupArn(
            this,
            "connect-worker-container-log",
            this.CLOUD_WATCH_LOG_GROUP_ARN
          ),
          streamPrefix: "connect-worker-container-"
        }),
        memoryLimitMiB: 1024,
        environment: {
          GROUP_ID: "jira-connect-postgres",
          LOG_LEVEL: "ERROR",
          CONFIG_STORAGE_TOPIC: "jiar-connect-config",
          OFFSET_STORAGE_TOPIC: "jiar-connect-offset",
          STATUS_STORAGE_TOPIC: "jiar-connect-status",
          BOOTSTRAP_SERVERS:<your_BOOTSTRAP_SERVERS>,
          OFFSET_FLUSH_TIMEOUT_MS: "8000",
          OFFSET_FLUSH_INTERVAL_MS: "10000",
          SHUTDOWN_TIMEOUT: "16000",
          HEAP_OPTS: "-Xmx4G -Xms4G",
          CONNECT_OFFSET_STORAGE_REPLICATION_FACTOR: "3",
          CONNECT_CONFIG_STORAGE_REPLICATION_FACTOR: "3",
          CONNECT_STATUS_STORAGE_REPLICATION_FACTOR: "3",
          CONNECT_PRODUCER_BUFFER_MEMORY: "163840"
        }
      }
    );

    // connect worker listening on port 8083
    connectWorkerContainer.addPortMappings({
      containerPort: 8083,
      protocol: ecs.Protocol.TCP
    });

    //  create container definition for topics ui
    const topicUiContainer = connectWorkerTaskDefinition.addContainer("topics-ui-container", {
      image: ecs.ContainerImage.fromRegistry("landoop/kafka-topics-ui"),
      logging: new ecs.AwsLogDriver({
        logGroup: LogGroup.fromLogGroupArn(
          this,
          "topics-ui-container-log",
          this.CLOUD_WATCH_LOG_GROUP_ARN
        ),
        streamPrefix: "topics-ui-container-"
      }),
      memoryLimitMiB: 512,
      environment: {
        KAFKA_REST_PROXY_URL: `${this.SERVICE_CONNECT_UI_NAME}.${this.PRIVATE_DNS_NAMESPACE}:8086`,
        PROXY: "true"
      }
    });

    // topics ui listening on port 8000
    topicUiContainer.addPortMappings({
      containerPort: 8000,
      protocol: ecs.Protocol.TCP
    });

    // create task definition for connect UI
    const connectUiTaskDefinition = new ecs.TaskDefinition(this, "connectUiTaskDef", {
      memoryMiB: "2048",
      cpu: "512",
      taskRole: Role.fromRoleArn(this, "connectUiTaskRole", this.ECS_TASK_EXECUTION_ROLE),
      executionRole: Role.fromRoleArn(this, "connectUiExecutionRole", this.ECS_TASK_EXECUTION_ROLE),
      family: "connectUiTaskDefinition",
      networkMode: ecs.NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.FARGATE
    });

    //  create container definition for connect UI
    const connectUiContainer = connectUiTaskDefinition.addContainer("connect-ui-container", {
      image: ecs.ContainerImage.fromRegistry("landoop/kafka-connect-ui"),
      memoryLimitMiB: 512,
      logging: new ecs.AwsLogDriver({
        logGroup: LogGroup.fromLogGroupArn(
          this,
          "connect-ui-container-log",
          this.CLOUD_WATCH_LOG_GROUP_ARN
        ),
        streamPrefix: "connect-ui-container-"
      }),
      environment: {
        CONNECT_URL: `${this.SERVICE_CONNECT_WORKER_NAME}.${this.PRIVATE_DNS_NAMESPACE}:8083`
      }
    });

    // ui listening on port 8000
    connectUiContainer.addPortMappings({
      containerPort: 8000,
      protocol: ecs.Protocol.TCP
    });

    //  create container definition for rest proxy
    const restProxyContainer = connectUiTaskDefinition.addContainer("rest-proxy-container", {
      image: ecs.ContainerImage.fromRegistry("confluentinc/cp-kafka-rest"),
      memoryLimitMiB: 1024,
      logging: new ecs.AwsLogDriver({
        logGroup: LogGroup.fromLogGroupArn(
          this,
          "rest-proxy-container-log",
          this.CLOUD_WATCH_LOG_GROUP_ARN
        ),
        streamPrefix: "cp-kafka-rest-container-"
      }),
      environment: {
        KAFKA_REST_HOST_NAME: "localhost",
        KAFKA_REST_BOOTSTRAP_SERVERS::<your_BOOTSTRAP_SERVERS>,
        KAFKA_REST_CLIENT_SECURITY_PROTOCOL: "SSL",
        KAFKA_REST_LISTENERS: "http://0.0.0.0:8086",
        KAFKA_REST_CONSUMER_REQUEST_TIMEOUT_MS: "40000"
      }
    });

    // rest proxy listening on port 8086
    restProxyContainer.addPortMappings({
      containerPort: 8086,
      protocol: ecs.Protocol.TCP
    });

    const connectWorkerService = new ecs.FargateService(this, "ConnectWorkerService", {
      serviceName: this.SERVICE_CONNECT_WORKER_NAME,
      cluster,
      vpcSubnets: {
        subnets: [
          {
            subnetId: "subnet-0306340c00d87b93b",
            availabilityZone: "ap-southeast-2c"
          }
        ] as ec2.ISubnet[]
      },
      taskDefinition: connectWorkerTaskDefinition,
      enableECSManagedTags: true,
      desiredCount: 1,
      securityGroups: [
        SecurityGroup.fromSecurityGroupId(
          this,
          "elasticsearch-poc-sg-02-worker",
          this.ELASTICSEARCH_POC_SG
        )
      ],
      cloudMapOptions: {
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.minutes(5),
        name: this.SERVICE_CONNECT_WORKER_NAME,
        cloudMapNamespace: namespace
      }
    });

    const connectUIService = new ecs.FargateService(this, "ConnectUIService", {
      serviceName: this.SERVICE_CONNECT_UI_NAME,
      cluster,
      vpcSubnets: {
        subnets: [
          {
            subnetId: "subnet-0306340c00d87b93b",
            availabilityZone: "ap-southeast-2c"
          }
        ] as ec2.ISubnet[]
      },
      taskDefinition: connectUiTaskDefinition,
      enableECSManagedTags: true,
      desiredCount: 1,
      securityGroups: [
        SecurityGroup.fromSecurityGroupId(
          this,
          "elasticsearch-poc-sg-02-ui",
          this.ELASTICSEARCH_POC_SG
        )
      ],
      cloudMapOptions: {
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.minutes(5),
        name: this.SERVICE_CONNECT_UI_NAME,
        cloudMapNamespace: namespace
      }
    });
  }
}
