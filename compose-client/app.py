import asyncio
import time

from sanic import Sanic
from sanic.log import logger
from sanic.response import text
from tasks import list_containers

app = Sanic("MyHelloWorldApp")


@app.get("/")
async def hello_world(request):
    return text("Hello, world.")


async def test(app):
    logger.info(323)
    while True:
        await asyncio.sleep(1)
        print(2342342)



async def notify_server_started_after_five_seconds():
    await asyncio.sleep(5)
    print('Server successfully started!')


app.add_task(notify_server_started_after_five_seconds())

app.add_task(test(app))

if __name__ == '__main__':
    app.run()
