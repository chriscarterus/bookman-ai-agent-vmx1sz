# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables for domain configuration
variable "domain_name" {
  description = "Primary domain name for the Bookman AI platform"
  type        = string
}

variable "enable_dnssec" {
  description = "Enable DNSSEC for the hosted zone"
  type        = bool
  default     = true
}

# Primary Route53 Hosted Zone
resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "Managed by Terraform - Bookman AI Platform ${var.environment}"

  tags = {
    Name          = "Bookman AI DNS Zone"
    Environment   = var.environment
    Project       = "BookmanAI"
    ManagedBy     = "Terraform"
    CostCenter    = "Infrastructure"
    SecurityLevel = "Critical"
  }
}

# Primary A Record for CloudFront Distribution
resource "aws_route53_record" "main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id               = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# WWW CNAME Record
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = [var.domain_name]
}

# Primary Health Check for the Main Domain
resource "aws_route53_health_check" "primary" {
  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  regions = [
    "us-east-1",
    "us-west-2",
    "eu-west-1"
  ]

  tags = {
    Name          = "Bookman AI Health Check - Primary"
    Environment   = var.environment
    Project       = "BookmanAI"
    ManagedBy     = "Terraform"
    CostCenter    = "Infrastructure"
    SecurityLevel = "Critical"
  }

  enable_sni = true
  search_string = "\"status\":\"healthy\""
}

# API Subdomain Health Check
resource "aws_route53_health_check" "api" {
  fqdn              = "api.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "2"
  request_interval  = "10"

  regions = [
    "us-east-1",
    "us-west-2",
    "eu-west-1"
  ]

  tags = {
    Name          = "Bookman AI Health Check - API"
    Environment   = var.environment
    Project       = "BookmanAI"
    ManagedBy     = "Terraform"
    CostCenter    = "Infrastructure"
    SecurityLevel = "Critical"
  }

  enable_sni = true
  search_string = "\"status\":\"healthy\""
}

# API Subdomain Record with Latency-Based Routing
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  latency_routing_policy {
    region = var.aws_region
  }

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id               = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.api.id
  set_identifier  = "primary"
}

# Monitoring Subdomain Record
resource "aws_route53_record" "monitoring" {
  count   = var.environment == "production" ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = "monitoring.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id               = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# CAA Records for SSL/TLS Certificate Issuance
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "CAA"
  ttl     = "300"

  records = [
    "0 issue \"amazon.com\"",
    "0 issue \"amazontrust.com\"",
    "0 issuewild \"amazontrust.com\"",
    "0 iodef \"mailto:security@${var.domain_name}\""
  ]
}

# TXT Record for Domain Verification
resource "aws_route53_record" "txt" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = "300"

  records = [
    "v=spf1 include:_spf.amazon.com ~all",
    "amazon-site-verification=${random_string.domain_verification.result}"
  ]
}

# Random string for domain verification
resource "random_string" "domain_verification" {
  length  = 32
  special = false
}

# Outputs
output "route53_zone_id" {
  description = "The hosted zone ID for the Route53 zone"
  value       = aws_route53_zone.main.zone_id
}

output "route53_nameservers" {
  description = "The nameservers for the Route53 zone"
  value       = aws_route53_zone.main.name_servers
}

output "domain_verification_string" {
  description = "Domain verification string for AWS services"
  value       = random_string.domain_verification.result
  sensitive   = true
}