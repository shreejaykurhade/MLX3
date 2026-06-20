import unittest

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient

from app.main import app


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.account = Account.create()

    def _authenticate(self):
        nonce = self.client.get("/auth/nonce").json()["nonce"]
        message = "\n".join(
            [
                "localhost wants you to sign in with your Ethereum account:",
                self.account.address,
                "",
                "Sign in to MLX3",
                "",
                "URI: http://localhost",
                "Version: 1",
                "Chain ID: 10143",
                f"Nonce: {nonce}",
            ]
        )
        signature = Account.sign_message(encode_defunct(text=message), self.account.key).signature.hex()
        response = self.client.post(
            "/auth/verify",
            json={"address": self.account.address, "message": message, "signature": signature},
        )
        return nonce, message, signature, response

    def test_issues_token_for_valid_signature_and_nonce(self):
        _, _, _, response = self._authenticate()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["token"])

    def test_nonce_cannot_be_replayed(self):
        _, message, signature, response = self._authenticate()
        self.assertEqual(response.status_code, 200)
        replay = self.client.post(
            "/auth/verify",
            json={"address": self.account.address, "message": message, "signature": signature},
        )
        self.assertEqual(replay.status_code, 400)

    def test_session_creation_requires_token(self):
        response = self.client.post(
            "/sessions",
            json={"wallet_address": self.account.address, "task_prompt": "test", "task_type": "prompt"},
        )
        self.assertIn(response.status_code, (401, 403))


if __name__ == "__main__":
    unittest.main()
