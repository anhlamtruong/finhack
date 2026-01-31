

<div align="center">

<!-- Inline logo (no extra files needed) -->
<svg width="560" height="120" viewBox="0 0 560 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chuchube Finance">
  <defs>
    <linearGradient id="g" x1="40" y1="20" x2="520" y2="100" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF4FA3"/>
      <stop offset="1" stop-color="#6A5CFF"/>
    </linearGradient>
  </defs>
  <rect x="10" y="16" width="100" height="88" rx="22" fill="url(#g)" opacity="0.18"/>
  <path d="M60 96c-20-14-32-28-32-44 0-14 10-24 23-24 8 0 15 4 19 10 4-6 11-10 19-10 13 0 23 10 23 24 0 16-12 30-32 44l-10 7-10-7z" fill="url(#g)"/>
  <text x="130" y="64" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="38" font-weight="800" fill="#0F172A">Chuchube Finance</text>
  <text x="130" y="92" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="16" font-weight="700" fill="#475569">Infrastructure as Code • AWS • Terraform</text>
</svg>

</div>

# Why??

This folder manages **AWS infrastructure** for Chuchube Finance using **Terraform**.

*Provision the cloud infrastructure Chube needs (not just run code locally)
*Define that infrastructure as code (.tf files)...  so everyone on the team can create the same setup
*Deploy API as a container by setting up:
*ECR (Elastic Container Registry) to store your Docker image
*App Runner to run that container publicly as a managed web service
*IAM roles/policies so App Runner can pull images from ECR safely

## What’s in here

This repo currently includes (at minimum):

- **ECR repository** for container images
- **Lifecycle policy** (keep recent images)

> Check the `.tf` files in this folder to see the exact resources being managed (e.g. `ecr.tf`, `main.tf`).

## Prerequisites

- Terraform installed (`terraform -v`)
- AWS CLI v2 installed (`aws --version`)
- Access to the AWS account via **AWS SSO** (recommended)

## AWS auth 

If your AWS CLI profile is named `chuchube`:

```bash
aws sso login --profile chuchube
aws sts get-caller-identity --profile chuchube
```

## Quick start

From the repo root:

```bash
cd infra/terraform
export AWS_PROFILE=chuchube

terraform fmt -recursive
terraform init
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

## Outputs

If an output like `ecr_repository_url` exists:

```bash
cd infra/terraform
export AWS_PROFILE=chuchube
terraform output
terraform output -raw ecr_repository_url
```

## Build + push an image to ECR (example)

This assumes:
- your AWS region is `us-east-1` (adjust if your provider uses a different region)
- your backend image is built from `./apps/llm` (adjust path if needed)

```bash
cd infra/terraform
export AWS_PROFILE=chuchube

REPO_URL="$(terraform output -raw ecr_repository_url)"
echo "ECR: $REPO_URL"

aws ecr get-login-password --region us-east-1 --profile chuchube \
  | docker login --username AWS --password-stdin "${REPO_URL%/*}"

docker build -t chuchube-api:latest ../../apps/llm
docker tag chuchube-api:latest "$REPO_URL:latest"
docker push "$REPO_URL:latest"
```

## Notes

- Keep infra changes small and reviewable: one PR per infra change.
- Always run `terraform plan` and attach the plan output in the PR description.
- If you change resource names, expect replacements; call that out explicitly.