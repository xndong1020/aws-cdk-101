import { App, Stack, StackProps, CfnOutput } from "@aws-cdk/core";
import { SecurityGroup, SubnetType, Vpc, Peer, Port } from "@aws-cdk/aws-ec2";

export class VpcStack extends Stack {
  readonly vpc: Vpc;
  readonly ingressSecurityGroup: SecurityGroup;
  readonly egressSecurityGroup: SecurityGroup;

  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC with  public subnet, private subnet and isolated subnet
    this.vpc = new Vpc(this, "CustomVPC", {
      cidr: "10.0.0.0/16",
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "myPublicSubnet",
          subnetType: SubnetType.PUBLIC,
        },
      ],
      // The 'natGateways' parameter now controls the number of NAT instances
      natGateways: 1,
    });
    // this.vpc = new Vpc(this, "CustomVPC", {
    //   cidr: "10.0.0.0/16",
    //   maxAzs: 2,
    //   subnetConfiguration: [
    //     {
    //       cidrMask: 24,
    //       name: "myPublicSubnet",
    //       subnetType: SubnetType.PUBLIC,
    //     },
    //     {
    //       cidrMask: 24,
    //       name: "myPrivateSubnet",
    //       subnetType: SubnetType.PRIVATE,
    //     },
    //   ],
    //   // The 'natGateways' parameter now controls the number of NAT instances
    //   natGateways: 2,
    // });

    new CfnOutput(this, "VpcOutput", { value: this.vpc.vpcId });

    this.ingressSecurityGroup = new SecurityGroup(
      this,
      "ingress-security-group",
      {
        vpc: this.vpc,
        description: "Allow access to ec2 instances",
        allowAllOutbound: true,
        securityGroupName: "IngressSecurityGroup",
      }
    );
    this.ingressSecurityGroup.addIngressRule(
      // Peer.ipv4("10.0.0.0/16"),
      Peer.anyIpv4(),
      Port.tcp(80)
    );

    this.egressSecurityGroup = new SecurityGroup(
      this,
      "egress-security-group",
      {
        vpc: this.vpc,
        allowAllOutbound: true,
        securityGroupName: "EgressSecurityGroup",
      }
    );
    this.egressSecurityGroup.addEgressRule(Peer.anyIpv4(), Port.tcp(80));
  }
}
