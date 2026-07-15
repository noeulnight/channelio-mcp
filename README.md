# Channel.io MCP Server

Channel.io 상담을 AI 에이전트에서 조회하고 관리하는 로컬 MCP 서버입니다.

- 유저, 상담, 메시지, 매니저 조회
- 상담 생성, 상태 변경, 담당자 배정
- 내부 메모와 유저 답장을 분리하는 발송 권한
- 에이전트 컨텍스트를 줄이는 compact 응답

## Get started

필요한 항목:

- Node.js 22 이상
- Channel.io Open API access key와 access secret

### Codex

`~/.codex/config.toml`에 추가합니다.

```toml
[mcp_servers.channelio]
command = "npx"
args = ["-y", "@noeulnight/channelio-mcp@latest"]
startup_timeout_sec = 120

[mcp_servers.channelio.env]
CHANNEL_ACCESS_KEY = "your-access-key"
CHANNEL_ACCESS_SECRET = "your-access-secret"
CHANNEL_SEND_MODE = "internal"
```

### Other MCP clients

stdio MCP 서버를 지원하는 클라이언트에서는 다음 구성을 사용합니다.

```json
{
  "mcpServers": {
    "channelio": {
      "command": "npx",
      "args": ["-y", "@noeulnight/channelio-mcp@latest"],
      "env": {
        "CHANNEL_ACCESS_KEY": "your-access-key",
        "CHANNEL_ACCESS_SECRET": "your-access-secret",
        "CHANNEL_SEND_MODE": "internal"
      }
    }
  }
}
```

설정 후 MCP 클라이언트를 다시 시작합니다.

## Send mode

`CHANNEL_SEND_MODE`은 에이전트가 메시지를 보낼 수 있는 범위를 제한합니다.

| 값         | 동작                                                      |
| ---------- | --------------------------------------------------------- |
| `disabled` | 메시지 전송 도구를 노출하지 않습니다.                     |
| `internal` | 모든 메시지를 매니저에게만 보이는 내부 메모로 작성합니다. |
| `all`      | 내부 메모와 유저에게 보이는 답장을 모두 허용합니다.       |

기본값은 `disabled`입니다. 유저 답장이 필요하지 않다면 `internal`을 권장합니다.

`internal` 모드는 모든 메시지에 Channel.io의 `private` 옵션을 강제합니다. `all` 모드에서는 호출 시 `private` 옵션을 지정한 메시지만 내부 메모가 됩니다.

이 설정은 `send_user_chat_message`에만 적용됩니다. 다른 변경 도구의 노출 여부에는 영향을 주지 않습니다.

## Usage

설정이 끝나면 에이전트에게 자연어로 요청할 수 있습니다.

- “진행 중인 상담 10개 보여줘.”
- “이 유저의 상담과 최근 메시지를 확인해줘.”
- “이 상담에 내부 메모로 인수인계 내용을 남겨줘.”
- “이 상담을 30분 동안 보류해줘.”
- “이 상담 담당자를 김매니저로 변경해줘.”

유저에게 보이는 답장은 `CHANNEL_SEND_MODE=all`일 때만 가능합니다.

## Tools

### Read

| 도구                             | 설명                                   |
| -------------------------------- | -------------------------------------- |
| `get_user`                       | `userId` 또는 `memberId`로 유저 조회   |
| `list_user_chats`                | 상태별 또는 특정 유저의 상담 목록 조회 |
| `get_user_chat`                  | 상담 상세 조회                         |
| `list_user_chat_messages`        | 상담 메시지 목록 조회                  |
| `get_user_chat_message_file_url` | 첨부파일 다운로드 URL 조회             |
| `get_managers`                   | 매니저 목록 또는 단건 조회             |

### Write

| 도구                           | 설명                                           |
| ------------------------------ | ---------------------------------------------- |
| `create_user_chat`             | 특정 유저에게 신규 상담 생성                   |
| `send_user_chat_message`       | 발송 권한에 따라 내부 메모 또는 유저 답장 작성 |
| `change_user_chat_status`      | 상담 열기, 보류 또는 종료                      |
| `assign_user_chat`             | 상담 담당 매니저 배정                          |
| `invite_managers_to_user_chat` | 상담에 매니저 초대                             |

## Configuration

| 환경변수                | 기본값                   | 설명                                  |
| ----------------------- | ------------------------ | ------------------------------------- |
| `CHANNEL_ACCESS_KEY`    | 필수                     | Channel.io Open API access key        |
| `CHANNEL_ACCESS_SECRET` | 필수                     | Channel.io Open API access secret     |
| `CHANNEL_SEND_MODE`     | `disabled`               | `disabled`, `internal`, `all` 중 하나 |
| `CHANNEL_VERSION`       | `2026-06-01`             | Channel.io API 버전                   |
| `CHANNEL_API_BASE_URL`  | `https://api.channel.io` | API base URL                          |

## Responses

모든 도구의 `responseMode` 기본값은 `compact`입니다. 작업에 필요한 필드만 반환해 에이전트의 토큰 사용량을 줄입니다. Channel.io 원본 응답이 필요하면 `responseMode: "full"`을 사용합니다.

목록 조회는 기본 10개를 반환하며 `nextCursor`로 다음 페이지를 조회합니다. 429 응답에는 에이전트가 같은 호출을 나중에 다시 시도할 수 있도록 `retryAfter`와 `action`을 포함합니다.

## Troubleshooting

| 증상                      | 확인할 항목                                                 |
| ------------------------- | ----------------------------------------------------------- |
| 서버가 시작되지 않음      | access key와 access secret이 모두 설정됐는지 확인합니다.    |
| 메시지 도구가 보이지 않음 | `CHANNEL_SEND_MODE`이 `internal` 또는 `all`인지 확인합니다. |
| 설정 변경이 반영되지 않음 | MCP 서버 또는 클라이언트를 다시 시작합니다.                 |
