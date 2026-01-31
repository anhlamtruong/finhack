resource "aws_apprunner_service" "api" {
  service_name = "${var.project_name}-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.app.repository_url}:latest"
      image_repository_type = "ECR"

      image_configuration {
        port = "8080" # change if your container listens on a different port
      }
    }

    auto_deployments_enabled = true
  }
}

output "apprunner_url" {
  value = aws_apprunner_service.api.service_url
}