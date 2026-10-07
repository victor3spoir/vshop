variable "TAG" {
  default = "dev"
}

variable "REGISTRY" {
  default = "ghcr.io"
}

variable "IMAGE_NAMESPACE" {
  default = "victor3spoir"
}

variable "PROJECT" {
  default = "vshop"
}

variable "REVISION" {
  default = ""
}


target "_common" {
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/victor3spoir/vshop"
    "org.opencontainers.image.version" = TAG
    "org.opencontainers.image.revision" = REVISION
  }
}

target "backend" {
  inherits   = ["_common"]
  context = "./backend"
  dockerfile = "Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/${PROJECT}-backend:${TAG}",
  ]
  labels = {
    "org.opencontainers.image.title" = "vshop-backend"
  }
}

target "frontend" {
  inherits   = ["_common"]
  context = "./frontend"
  dockerfile = "Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/${PROJECT}-frontend:${TAG}",
  ]
  labels = {
    "org.opencontainers.image.title" = "vshop-frontend"
  }
}

group "default" {
  targets = ["backend", "frontend"]
}