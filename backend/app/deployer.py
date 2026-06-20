"""Build and run public GitHub repositories as routed Docker containers."""
from __future__ import annotations

import asyncio
import json
import re
import shutil
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable, Optional
from urllib.parse import urlparse

from .config import settings

LogCallback = Callable[[str], Awaitable[None]]
_REPO_PATH = re.compile(r"^/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$")
_SLUG_CHARS = re.compile(r"[^a-z0-9-]+")


class DeploymentError(RuntimeError):
    pass


@dataclass(frozen=True)
class Repository:
    owner: str
    name: str

    @property
    def clone_url(self) -> str:
        return f"https://github.com/{self.owner}/{self.name}.git"


@dataclass(frozen=True)
class DeploymentResult:
    slug: str
    url: str
    container_id: str
    image: str
    container_port: int
    build_type: str


def parse_public_github_url(value: str) -> Repository:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise DeploymentError("repository must be an https://github.com/owner/repo URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise DeploymentError("repository URL must not contain credentials, query parameters, or fragments")
    match = _REPO_PATH.fullmatch(parsed.path)
    if not match:
        raise DeploymentError("repository URL must identify exactly one GitHub owner and repository")
    return Repository(owner=match.group(1), name=match.group(2))


def deployment_slug(repo_name: str, session_id: str) -> str:
    base = _SLUG_CHARS.sub("-", repo_name.lower()).strip("-")[:38] or "site"
    suffix = re.sub(r"[^a-f0-9]", "", session_id.lower())[:8]
    return f"{base}-{suffix or 'deploy'}"


def _generated_dockerfile(root: Path) -> tuple[str, int, str]:
    package_file = root / "package.json"
    if package_file.exists():
        package = json.loads(package_file.read_text(encoding="utf-8"))
        scripts = package.get("scripts", {})
        if "start" not in scripts:
            if "build" not in scripts:
                raise DeploymentError("Node repository needs a start script or a build script for a static site")
            content = """FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir /site && if [ -d dist ]; then cp -r dist/. /site/; elif [ -d build ]; then cp -r build/. /site/; else exit 1; fi
FROM nginx:1.27-alpine
COPY --from=build /site /usr/share/nginx/html
EXPOSE 80
"""
            return content, 80, "generated-node-static"

        build_line = "RUN npm run build\n" if "build" in scripts else ""
        content = f"""FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
{build_line}RUN npm prune --omit=dev
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
CMD [\"npm\", \"start\"]
"""
        return content, 3000, "generated-node"

    if (root / "requirements.txt").exists():
        module = "main" if (root / "main.py").exists() else "app" if (root / "app.py").exists() else None
        if not module:
            raise DeploymentError("Python repository needs main.py, app.py, or its own Dockerfile")
        content = f"""FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8000
EXPOSE 8000
CMD [\"sh\", \"-c\", \"uvicorn {module}:app --host 0.0.0.0 --port $PORT\"]
"""
        return content, 8000, "generated-python"

    if (root / "index.html").exists():
        return (
            "FROM nginx:1.27-alpine\nCOPY . /usr/share/nginx/html\nEXPOSE 80\n",
            80,
            "generated-static",
        )

    raise DeploymentError("repository needs a Dockerfile, package.json, requirements.txt, or index.html")


def prepare_build(root: Path) -> tuple[int, str]:
    dockerfile = root / "Dockerfile"
    if dockerfile.exists():
        return settings.deploy_default_port, "repository-dockerfile"
    content, port, build_type = _generated_dockerfile(root)
    dockerfile.write_text(content, encoding="ascii")
    return port, build_type


def _image_port(image, fallback: int) -> int:
    exposed = (image.attrs.get("Config", {}).get("ExposedPorts") or {}).keys()
    ports = []
    for item in exposed:
        try:
            ports.append(int(item.split("/", 1)[0]))
        except ValueError:
            continue
    for preferred in (3000, 8080, 80, 8000, 5000):
        if preferred in ports:
            return preferred
    return ports[0] if ports else fallback


async def deploy_repository(github_url: str, session_id: str, log: LogCallback) -> DeploymentResult:
    if not settings.deploy_enabled:
        raise DeploymentError("repository deployment is disabled; configure DEPLOY_DOMAIN")
    repo = parse_public_github_url(github_url)
    slug = deployment_slug(repo.name, session_id)
    await log(f"Cloning public repository {repo.owner}/{repo.name}...")

    work_root = Path(settings.deploy_work_root) if settings.deploy_work_root else None
    if work_root:
        work_root.mkdir(parents=True, exist_ok=True)
    workspace = Path(tempfile.mkdtemp(prefix=f"mlx3-{slug}-", dir=work_root))
    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--depth", "1", "--single-branch", "--", repo.clone_url, str(workspace / "repo"),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        output, _ = await asyncio.wait_for(proc.communicate(), timeout=settings.deploy_clone_timeout)
        clone_output = output.decode(errors="replace")[-4000:]
        if proc.returncode != 0:
            raise DeploymentError(f"git clone failed: {clone_output.strip()}")

        root = workspace / "repo"
        fallback_port, build_type = prepare_build(root)
        image_tag = f"mlx3-deploy/{slug}:latest"
        await log(f"Building image ({build_type})...")
        result = await asyncio.to_thread(_docker_build_and_run, root, image_tag, slug, fallback_port)
        await log(f"Deployment is live at {result.url}")
        return result
    except asyncio.TimeoutError as exc:
        raise DeploymentError("repository clone timed out") from exc
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


def _docker_build_and_run(root: Path, image_tag: str, slug: str, fallback_port: int) -> DeploymentResult:
    try:
        import docker
        from docker.errors import BuildError, DockerException
    except ImportError as exc:
        raise DeploymentError("Docker SDK is not installed") from exc

    try:
        client = docker.from_env(timeout=settings.deploy_build_timeout)
        client.ping()
        image, _ = client.images.build(
            path=str(root), tag=image_tag, rm=True, forcerm=True,
            network_mode=settings.deploy_build_network,
        )
        port = _image_port(image, fallback_port)
        container_name = f"mlx3-{slug}"
        try:
            previous = client.containers.get(container_name)
            previous.remove(force=True)
        except docker.errors.NotFound:
            pass

        host = f"{slug}.{settings.deploy_domain}"
        labels = {
            "traefik.enable": "true",
            "traefik.docker.network": settings.deploy_network,
            f"traefik.http.routers.{slug}.rule": f"Host(`{host}`)",
            f"traefik.http.routers.{slug}.entrypoints": "websecure",
            f"traefik.http.routers.{slug}.tls.certresolver": "letsencrypt",
            f"traefik.http.services.{slug}.loadbalancer.server.port": str(port),
            "mlx3.session_id": slug,
            "mlx3.managed": "true",
        }
        container = client.containers.run(
            image.id,
            detach=True,
            name=container_name,
            hostname=slug,
            network=settings.deploy_network,
            labels=labels,
            environment={"PORT": str(port)},
            mem_limit=settings.deploy_memory_limit,
            nano_cpus=settings.deploy_nano_cpus,
            pids_limit=settings.deploy_pids_limit,
            restart_policy={"Name": "unless-stopped"},
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
        )
        time.sleep(2)
        container.reload()
        if container.status not in ("created", "running"):
            logs = container.logs(tail=80).decode(errors="replace")
            container.remove(force=True)
            raise DeploymentError(f"container failed to start: {logs}")
        return DeploymentResult(
            slug=slug,
            url=f"https://{host}",
            container_id=container.id,
            image=image_tag,
            container_port=port,
            build_type="docker",
        )
    except BuildError as exc:
        detail = "\n".join(str(line.get("stream", "")).strip() for line in exc.build_log[-40:])
        raise DeploymentError(f"Docker build failed: {detail[-6000:]}") from exc
    except DockerException as exc:
        raise DeploymentError(f"Docker deployment failed: {exc}") from exc
