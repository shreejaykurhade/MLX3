import json
import tempfile
import unittest
from pathlib import Path

from app.deployer import DeploymentError, deployment_slug, parse_public_github_url, prepare_build


class RepositoryValidationTests(unittest.TestCase):
    def test_accepts_canonical_public_repository(self):
        repo = parse_public_github_url("https://github.com/example/demo.git")
        self.assertEqual(repo.owner, "example")
        self.assertEqual(repo.name, "demo")
        self.assertEqual(repo.clone_url, "https://github.com/example/demo.git")

    def test_rejects_credentials_and_non_github_hosts(self):
        bad = (
            "https://token@github.com/example/demo",
            "https://gitlab.com/example/demo",
            "git@github.com:example/demo.git",
            "https://github.com/example/demo?token=secret",
        )
        for value in bad:
            with self.subTest(value=value), self.assertRaises(DeploymentError):
                parse_public_github_url(value)

    def test_slug_is_dns_safe_and_unique_per_session(self):
        self.assertEqual(deployment_slug("My_App!", "abcdef12-0000"), "my-app-abcdef12")


class BuildDetectionTests(unittest.TestCase):
    def test_keeps_repository_dockerfile(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Dockerfile").write_text("FROM nginx", encoding="ascii")
            self.assertEqual(prepare_build(root), (3000, "repository-dockerfile"))

    def test_generates_node_server_image(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text(
                json.dumps({"scripts": {"build": "next build", "start": "next start"}}), encoding="ascii"
            )
            port, build_type = prepare_build(root)
            self.assertEqual((port, build_type), (3000, "generated-node"))
            self.assertIn('CMD ["npm", "start"]', (root / "Dockerfile").read_text(encoding="ascii"))

    def test_generates_static_image(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text("<h1>ok</h1>", encoding="ascii")
            self.assertEqual(prepare_build(root), (80, "generated-static"))


if __name__ == "__main__":
    unittest.main()
