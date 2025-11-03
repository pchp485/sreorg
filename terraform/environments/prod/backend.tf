terraform {
  backend "s3" {
    bucket         = "changeme-terraform-state"
    key            = "sreorg/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "changeme-terraform-locks"
    encrypt        = true
  }
}
