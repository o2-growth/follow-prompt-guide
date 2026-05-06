# Healthcheck Edge Function

Endpoint público que verifica saúde da aplicação + DB.

## Deploy

```bash
supabase functions deploy healthcheck --no-verify-jwt
```

> **`--no-verify-jwt`** é intencional — o endpoint precisa ser hit anonimamente
> pelo UptimeRobot. RLS no Supabase ainda protege os dados da query.

## URL

Após o deploy:

```
https://rzzxlaknknrqfvbsfelx.supabase.co/functions/v1/healthcheck
```

(substitua o subdomínio pelo do seu projeto se diferente)

## Resposta esperada

### Saudável (HTTP 200)

```json
{
  "status": "ok",
  "timestamp": "2026-05-06T13:00:00.000Z",
  "db": "up",
  "error": null
}
```

### Degradado / down (HTTP 503)

```json
{
  "status": "degraded",
  "timestamp": "2026-05-06T13:00:00.000Z",
  "db": "down",
  "error": "<mensagem>"
}
```

## Configurar UptimeRobot

1. Criar conta gratuita em [uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor**
   - Monitor Type: `HTTP(s)`
   - Friendly Name: `Strategic OS — Healthcheck`
   - URL: `https://rzzxlaknknrqfvbsfelx.supabase.co/functions/v1/healthcheck`
   - Monitoring Interval: `5 minutes`
   - HTTP Method: `GET`
   - Alert When: status code != 200 OR keyword "ok" not found
3. **Alert Contacts:** adicionar email + (opcional) webhook Slack
4. Salvar

## Alertas Slack (opcional)

UptimeRobot → My Settings → Alert Contacts → Add → Slack
Cole o webhook URL e teste. Em downtime, mensagem chega no canal `#alerts-strategicos`.

## Smoke local

```bash
supabase functions serve healthcheck
curl http://localhost:54321/functions/v1/healthcheck
```
