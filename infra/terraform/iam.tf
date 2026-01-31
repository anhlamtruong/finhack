data "aws_iam_policy_document" "apprunner_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "apprunner_ecr_access" {
  name               = "${var.project_name}-apprunner-ecr-access"
  assume_role_policy = data.aws_iam_policy_document.apprunner_assume.json
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}