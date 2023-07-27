from typing import Container, Sequence

from .client import client


# async def list_containers() -> Sequence[Container]:
#     try:
#         containers: Sequence[Container] = client.containers.list()
#         return containers
#     except Exception as e:
#         print("======")
#         return []


async def list_containers():
    try:
        await client.containers.list()
    except Exception as e:
        print("======")
        return []
