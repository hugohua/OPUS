
class DummySemaphore:
    async def __aenter__(self): return
    async def __aexit__(self, *args): return
