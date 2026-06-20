# MLX3 production deployment

The production stack runs on one Linux server:

- `app.example.com` - MLX3 frontend
- `api.example.com` - MLX3 API and WebSocket service
- `<project>.deploy.example.com` - public GitHub repository deployments

Traefik discovers containers through Docker labels and obtains individual HTTPS
certificates automatically. Postgres persists sessions and deployment metadata.

## Server requirements

- Public Linux server with Docker Engine and the Compose plugin
- At least 2 CPU cores, 4 GB RAM, and sufficient disk for repository images
- Inbound TCP ports 80 and 443 open
- Outbound HTTPS access for GitHub, container registries, Monad, and Anthropic

Do not expose the Docker API on unauthenticated TCP port 2375.

## DNS

Create these records with the provider that manages your domain. Replace the value with
the deployment server's public IPv4 address.

| Type | Name | Value |
| --- | --- | --- |
| A | `app` | server IPv4 |
| A | `api` | server IPv4 |
| A | `*.deploy` | server IPv4 |

The wildcard record is created once. MLX3 does not need a DNS API token to create each
project hostname. Traefik uses HTTP validation to issue a certificate when a project is
first deployed.

## Configure and start

```bash
git clone <repository-url> mlx3
cd mlx3
cp .env.production.example .env.production
nano .env.production
```

Set the actual hostnames, certificate email, database password, Anthropic key, agent
wallet key, and deployed Monad contract addresses. Keep `.env.production` private.

```bash
docker compose --env-file .env.production -f compose.production.yml up -d --build
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs -f
```

Verify:

```bash
curl https://api.example.com/health
curl -I https://app.example.com
```

## Repository support

Public repositories require no GitHub token. MLX3 accepts canonical
`https://github.com/owner/repository` URLs and supports:

- A repository-provided `Dockerfile`
- Node applications with `package.json`
- Python ASGI applications with `requirements.txt` and `main.py` or `app.py`
- Static sites containing `index.html`

Each runtime receives a memory limit, CPU quota, PID limit, dropped Linux capabilities,
and a dedicated routed hostname. Repository builds still execute untrusted build logic;
run this stack on a dedicated server, not on infrastructure containing unrelated secrets.

## Operations

```bash
git pull
docker compose --env-file .env.production -f compose.production.yml up -d --build

docker compose --env-file .env.production -f compose.production.yml logs -f backend traefik
docker ps --filter label=mlx3.managed=true
```

Do not run `docker compose down -v` unless deleting the database and TLS state is intended.
