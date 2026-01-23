terraform {
  backend "s3" {
    bucket         = "weather-app-challenge-terraform-state"
    key            = "terraform.tfstate"
    region         = "eu-west-3"
    encrypt        = true
    dynamodb_table = "weather-app-terraform-locks"
  }
}


