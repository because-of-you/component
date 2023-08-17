import docker

client = docker.from_env()

__all__ = ['client']
