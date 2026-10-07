variable "REGISTRY" {
  default = "ghcr.io"
}

variable "NAMESPACE" {
  default = "victor3spoir"
}

variable "REVISION" {
  default = "dev"
}

variable "SOURCE" {
  default = "https://github.com/victor3spoir/vshop"
}

variable "VERSION" {
  default = "dev"
}

variable "REVISION" {
  default = "unknown"
}

variable "PROJECT" {
  default = "vshop"
}

target "_common" {
  dockerfile = "Dockerfile"
  platforms = [ "linux/amd64" ]
  labels = {
    "org.opencontainers.image.title"       = "${PROJECT}"
    "org.opencontainers.image.description" = "VShop application"
    "org.opencontainers.image.source"      = "${SOURCE}"
    "org.opencontainers.image.revision"    = "${REVISION}"
    "org.opencontainers.image.version"     = "${VERSION}"
    "org.opencontainers.image.licenses"    = "MIT"
    "org.opencontainers.image.vendor"      = "victor3spoir"
  }
}

target "frontend" {
  inherits = [ "_common" ]
  context = "./frontend"
    labels = {
    "org.opencontainers.image.title"       = "${PROJECT}-frontend"
    "org.opencontainers.image.description" = "VShop frontend"
  }

  tags = [
    "${REGISTRY}/${NAMESPACE}/${PROJECT}-frontend:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/${PROJECT}-frontend:latest"
  ]
}

target "backend" {
  inherits = [ "_common" ]
  context = "./backend"

    labels = {
    "org.opencontainers.image.title"       = "${PROJECT}-backend"
    "org.opencontainers.image.description" = "VShop backend"
  }

  tags = [
    "${REGISTRY}/${NAMESPACE}/${PROJECT}-backend:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/${PROJECT}-backend:latest"
  ]
}

group "default" {
  targets = [ "frontend", "backend" ]
}