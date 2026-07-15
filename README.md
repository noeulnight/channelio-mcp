# Channel.io Open API MCP

## 개발

```bash
vp install
vp check
vp test
vp run build
```

## 환경변수

| 이름                    | 필수   | 기본값                   |
| ----------------------- | ------ | ------------------------ |
| `CHANNEL_ACCESS_KEY`    | 예     | -                        |
| `CHANNEL_ACCESS_SECRET` | 예     | -                        |
| `CHANNEL_VERSION`       | 아니오 | `2026-06-01`             |
| `CHANNEL_API_BASE_URL`  | 아니오 | `https://api.channel.io` |
| `CHANNEL_ALLOW_SEND`    | 아니오 | `false`                  |

`CHANNEL_ALLOW_SEND=true`일 때만 `send_user_chat_message` 도구가 노출됩니다.

## MCP 등록

npm 패키지를 `npx`로 실행할 수 있습니다.

```json
{
  "mcpServers": {
    "channel-talk": {
      "command": "npx",
      "args": ["-y", "@noeulnight/channelio-mcp@latest"],
      "env": {
        "CHANNEL_ACCESS_KEY": "...",
        "CHANNEL_ACCESS_SECRET": "...",
        "CHANNEL_ALLOW_SEND": "true"
      }
    }
  }
}
```

## 제공 도구

- `get_user`
- `list_user_chats`
- `get_user_chat`
- `create_user_chat`
- `list_user_chat_messages`
- `send_user_chat_message`
- `get_user_chat_message_file_url`
- `change_user_chat_status`
- `get_managers`
- `assign_user_chat`
- `invite_managers_to_user_chat`

각 도구는 `path`와 `query`를 직접 구성할 필요 없이 업무에 필요한 인자를 최상위 입력으로 받습니다.

## 배포

`package.json` 버전과 같은 Git tag를 push하면 GitHub Actions가 검증 후 npm에 배포합니다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

npm Trusted Publisher에는 GitHub 저장소 `noeulnight/channelio-mcp`와 workflow 파일 `publish.yml`을 등록해야 합니다.
