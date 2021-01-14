#!/bin/bash

for i in "$@"
do
case $i in
    --profile=*)
    profile="${i#*=}"
    shift # past argument=value
    ;;
    --stack=*)
    stack="${i#*=}"
    shift # past argument=value
    ;;
    --region=*)
    region="${i#*=}"
    shift # past argument=value
    ;;
    *)
          # unknown option
    ;;
esac
done

bucket=stokado-layers-${stack:-dev}

# create bucket
if [ "${region}" == "us-east-1" ]; then
aws s3api create-bucket --acl private --bucket $bucket --profile ${profile:-default} --region ${region:-"eu-west-1"} --no-cli-pager
else
aws s3api create-bucket --acl private --bucket $bucket --profile ${profile:-default} --region ${region:-"eu-west-1"} --create-bucket-configuration LocationConstraint=${region:-"eu-west-1"} --no-cli-pager
fi

# make it private
aws s3api put-public-access-block --profile ${profile:-default} --region ${region:-"eu-west-1"} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --bucket $bucket --no-cli-pager

# add tags
aws s3api put-bucket-tagging --profile ${profile:-default} --region ${region:-"eu-west-1"} --tagging 'TagSet=[{Key=app,Value=stokado},{Key=environment,Value=test}]' --bucket $bucket --no-cli-pager
