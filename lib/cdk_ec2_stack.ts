import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import { SubnetSelection, Subnet, Instance } from "@aws-cdk/aws-ec2";
import * as assets from "@aws-cdk/aws-s3-assets";

import {
  Role,
  ServicePrincipal,
  CfnInstanceProfile,
  ManagedPolicy,
} from "@aws-cdk/aws-iam";
import { Fn, Tag, Resource, CfnOutput, StackProps, App } from "@aws-cdk/core";
import {
  AmazonLinuxImage,
  UserData,
  SecurityGroup,
  Vpc,
} from "@aws-cdk/aws-ec2";

export interface CdkEc2StackProps {
  readonly image: ec2.IMachineImage;
  readonly instanceType: ec2.InstanceType;
  readonly subnet: ec2.ISubnet;
  readonly role?: Role;
  readonly name: String;
  readonly securityGroup: ec2.SecurityGroup;
  readonly userData?: UserData;
}

/**
 * Create my own Ec2 resource and Ec2 props as these are not yet defined in CDK
 * These classes abstract low level details from CloudFormation
 */
class Ec2InstanceProps {
  readonly image: ec2.IMachineImage;
  readonly instanceType: ec2.InstanceType;
  readonly subnet: ec2.ISubnet;
  readonly role?: Role;
  readonly name: String;
  readonly securityGroup: ec2.SecurityGroup;
  readonly userData?: UserData;
}

class Ec2 extends Resource {
  public instance: ec2.CfnInstance;

  constructor(scope: cdk.Construct, id: string, props?: Ec2InstanceProps) {
    super(scope, id);

    if (props) {
      // create the instance
      this.instance = new ec2.CfnInstance(this, id, {
        imageId: props.image.getImage(this).imageId,
        instanceType: props.instanceType.toString(),
        networkInterfaces: [
          {
            deviceIndex: "0",
            subnetId: props.subnet.subnetId,
            groupSet: [props.securityGroup.securityGroupName],
          },
        ],
      });
      if (props.role) {
        //create a profile to attch the role to the instance
        const profile = new CfnInstanceProfile(this, `${id}Profile`, {
          roles: [props.role.roleName],
        });
        this.instance.iamInstanceProfile = profile.ref;
      }
      if (props.userData) {
        this.instance.userData = Fn.base64(props.userData.render());
      }
      if (props.name) {
        // tag the instance
        Tag.add(this.instance, "Name", `${props.name}`);
      }
    }
  }
}

export interface CdkEc2StackProps {
  vpc: Vpc;
  ingressSecurityGroup: SecurityGroup;
  egressSecurityGroup: SecurityGroup;
}

const linuxAmi = new ec2.AmazonLinuxImage({
  generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
  edition: ec2.AmazonLinuxEdition.STANDARD,
  virtualization: ec2.AmazonLinuxVirt.HVM,
  storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
});

//
// The ec2 stack for this demo
//
export class CdkEc2Stack extends cdk.Stack {
  constructor(scope: App, id: string, props: CdkEc2StackProps) {
    super(scope, id);

    //
    // define the IAM role that will allow the EC2 instance to communicate with SSM
    //
    const ssmRole = new Role(this, "NewsBlogSSMRole", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });
    ssmRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    const myEc2Instance = new Ec2(this, "myEc2Instance", {
      image: linuxAmi,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      subnet: props.vpc.publicSubnets[0],
      name: "myEc2Instance",
      role: ssmRole,
      securityGroup: props.ingressSecurityGroup,
    });

    // Setup key_name for EC2 instance login if you don't use Session Manager
    myEc2Instance.instance.addPropertyOverride("KeyName", "jumpbox-key");
  }
}
