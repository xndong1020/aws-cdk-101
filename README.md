Install

```js
npm install -g aws-cdk

```

init project

```js
cdk init --language typescript

```

for each module you will need to install separately

```js
npm i @aws-cdk/aws-s3
npm i @aws-cdk/aws-ec2
```

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
- `cdk destroy` remove generated resources

#### Bootstrapping an environment

The first time you deploy an AWS CDK app into an environment (account/region), you’ll need to install a “bootstrap stack”. This stack includes resources that are needed for the toolkit’s operation. For example, the stack includes an S3 bucket that is used to store templates and assets during the deployment process.

```js
cdk bootstrap
```

### EXAMPLES

#### To create a S3 static hosting

[S3 static hosting Example](./01.static_hosting_example.md)

#### Deploy lamdba with dynamoDB

[lamdba with dynamoDB](./02.lambda_with_dynamodb_example.md)
