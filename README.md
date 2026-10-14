# OnGleam 사용자 플러그인

OnGleam의 일반 사용자용 Claude Code·Codex 스킬과 MCP 연결 설정을 한 원본에서 배포한다. 현재는 `use-ongleam` 스킬과 사용자 MCP 주소를 제공한다. 서버 접속·OAuth·도구 발견은 실제 호스트에서 확인해야 하며, 설정만으로 데이터 조회나 수집 성공이 보장되지는 않는다.

기존 설치와 호환되도록 플러그인 이름은 `ongleam-beta`로 유지한다. 관리자 MCP, 개발 전용 E2E 스킬, 내부 정책·hook은 이 저장소에 포함하지 않는다.

## 설치

저장소를 clone한 뒤 루트에서 실행한다.

Codex:

```sh
codex plugin marketplace add .
codex plugin add ongleam-beta@ongleam-beta
```

Claude Code:

```text
/plugin marketplace add .
/plugin install ongleam-beta@ongleam-beta
```

호스트를 다시 시작하거나 지원되는 plugin reload를 실행한 뒤 `use-ongleam` 스킬을 확인한다. 같은 이름의 marketplace가 이미 등록된 경우 등록 위치를 확인하고 기존 설치를 교체한다. 설치 명령은 현재 사용자 호스트의 plugin 설정을 변경한다.

## 개발 및 동기화

`plugins/ongleam-beta/plugin.json`은 이름·버전·설명의 원본이고, `plugins/ongleam-beta/mcp.json`은 사용자 MCP 주소의 원본이다. `skills/use-ongleam/SKILL.md`는 양쪽 호스트가 공유하는 사용 지침이다. 생성된 manifest나 marketplace를 직접 수정하지 않는다.

```sh
bun run plugins:sync
bun run check
claude plugin validate ./plugins/ongleam-beta
claude plugin validate ./.claude-plugin/marketplace.json
```

생성 파일은 `plugins/ongleam-beta/.claude-plugin/plugin.json`, `plugins/ongleam-beta/.codex-plugin/plugin.json`, `plugins/ongleam-beta/.mcp.json`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`이다. 변경 기여는 PR에서 검토한다.

beta 개발 저장소의 localhost 전용 플러그인은 이 저장소의 사용자용 `plugin.json`과 `use-ongleam` 스킬만 명시적으로 동기화한다. 향후 이 저장소에 사용자 MCP 설정이 추가되어도 이를 개발용 localhost 연결로 자동 복사하지 않는다.

## MCP 연결 상태

사용자 endpoint `https://beta-api.ongleam.com/mcp`만 포함한다. 관리자 endpoint와 credential은 포함하지 않는다. 실제 transport·OAuth·도구 발견은 Claude Code와 Codex에서 각각 검증해야 한다. 서버가 준비되면 허용 조직 조회, 조직 접근 거부, 작업 접수·상태 조회, 실제 UI↔MCP 교차 검증을 별도로 수행한다.
