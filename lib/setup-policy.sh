#!/bin/bash
set -e

AWS_PROFILE="${AWS_PROFILE}"

POLICY_ARN=$(AWS_PROFILE=$AWS_PROFILE aws iam create-policy \
        --policy-name PlatformaticWattDemosEKS \
        --policy-document file://minimum-policy.json \
        --description "Policy for running Platformatic Watt performance benchmarks" | jq -r '.Policy.Arn')

USER_NAME=$(AWS_PROFILE=$AWS_PROFILE aws iam get-user --query User.UserName --output text)

AWS_PROFILE=$AWS_PROFILE aws iam attach-user-policy --user-name ${USER_NAME} --policy-arn ${POLICY_ARN}
