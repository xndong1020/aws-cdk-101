import cdk = require("@aws-cdk/core");
import ec2 = require("@aws-cdk/aws-ec2");
import assets = require("@aws-cdk/aws-s3-assets");

import {
  Role,
  ServicePrincipal,
  CfnInstanceProfile,
  ManagedPolicy,
} from "@aws-cdk/aws-iam";
import { Fn, Resource, CfnOutput, Tags } from "@aws-cdk/core";
import { AmazonLinuxImage, UserData } from "@aws-cdk/aws-ec2";

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
        Tags.of(this.instance).add("Name", `${props.name}`);
      }
    }
  }
}

//
// The stack for this demo
//
export class VpcIngressRoutingStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //
    // The following JavaScript example defines an directory asset
    // which is archived as a .zip file
    // and uploaded to S3 during deployment.
    //
    var path = require("path");
    const asset = new assets.Asset(this, "SampleAsset", {
      path: path.join(__dirname, "../html"),
    });

    // Create a VPC with two public subnets
    const vpc = new ec2.Vpc(this, "NewsBlogVPC", {
      cidr: "10.0.0.0/16",
      maxAzs: 1,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: "appliance",
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: "application",
          cidrMask: 24,
        },
      ],
    });

    //
    // create a security group authorizing inbound traffic on port 80
    //
    const demoSecurityGroup = new ec2.SecurityGroup(this, "DemoSecurityGroup", {
      vpc,
      description: "Allow access to ec2 instances",
      allowAllOutbound: true, // Can be set to false
    });
    demoSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "allow HTTP access from the world"
    );

    // define the IAM role that will allow the EC2 instance to download web site from S3
    //
    const s3Role = new Role(this, "NewsBlogS3Role", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });
    // allow connect instance using Session Manager
    s3Role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );
    // allow instance to communicate with s3
    asset.grantRead(s3Role);

    //
    // define a user data script to install & launch a web server
    //
    const userData = UserData.forLinux();
    userData.addCommands(
      "yum install -y nginx",
      "chkconfig nginx on",
      "service nginx start"
    );
    /**
     * Asset constructs expose the following deploy-time attributes:
      s3BucketName - the name of the assets S3 bucket.
      s3ObjectKey - the S3 object key of the asset file (whether it's a file or a zip archive)
      s3ObjectUrl - the S3 object URL of the asset (i.e. s3://mybucket/mykey.zip)
      httpUrl - the S3 HTTP URL of the asset (i.e. https://s3.us-east-1.amazonaws.com/mybucket/mykey.zip)
     */
    userData.addCommands(
      `aws s3 cp s3://${asset.s3BucketName}/${asset.s3ObjectKey} .`,
      `unzip *.zip`,
      `/bin/mv /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.orig`,
      `/bin/cp -r -n index.html carousel.css /usr/share/nginx/html/`
    );

    const linuxAMI = new AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
    });

    //
    // launch an 'application' EC2 instance in the first public subnet
    // The instance will have ngninx and a static web site
    //
    const webServer1 = new Ec2(this, "NewsBlogApplication1", {
      image: linuxAMI,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      subnet: vpc.publicSubnets[0],
      name: "webServer1",
      securityGroup: demoSecurityGroup,
      role: s3Role,
      userData: userData,
    });

    //
    // launch an 'application' EC2 instance in the first public subnet
    // The instance will have ngninx and a static web site
    //
    const webServer2 = new Ec2(this, "NewsBlogApplication2", {
      image: linuxAMI,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      subnet: vpc.publicSubnets[1],
      name: "webServer2",
      securityGroup: demoSecurityGroup,
      role: s3Role,
      userData: userData,
    });

    new CfnOutput(this, "VPC-ID", { value: vpc.vpcId });
    new CfnOutput(this, "SERVER0-PUBLIC-DNSNAME", {
      value: webServer1.instance.attrPublicDnsName,
    });
    new CfnOutput(this, "SERVER1-PUBLIC-IP", {
      value: webServer2.instance.attrPublicIp,
    });
  }
}
