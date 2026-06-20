from fastapi import FastAPI, Depends
from fastapi.security import HTTPBearer
from fastapi.testclient import TestClient

app = FastAPI()
bearer = HTTPBearer(auto_error=True)

@app.post("/test")
def test_route(cred=Depends(bearer)):
    return {"ok": True}

client = TestClient(app)
res = client.post("/test")
print("Status Code:", res.status_code)
print("Response:", res.json())
