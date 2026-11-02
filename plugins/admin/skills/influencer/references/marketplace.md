# Meta Creator Marketplace: 클라이언트 수집

Meta 앱의 서버 API 승인을 받는 절차 대신, 사용자가 접근 가능한 로그인 브라우저에서 목록·상세를 열어 실제 응답을 수집한다. 새 계정 연결이나 운영 백필 권한을 스킬 실행 자체로 만들지 않는다. 대상 브랜드·검색 조건·수집 상한·저장할 조직은 사용자 지시와 화면으로 확인한다. 여러 조직 중 대상이 불명확하면 로컬 관찰을 진행하면서 운영 저장 대상만 확인한다.

## 브라우저와 scripts

1. 브라우저 inventory에서 실제 Meta Marketplace 탭을 찾는다. 없으면 사용자가 지정한 주소나 실제 Meta Business 화면의 링크로 이동한다. 로그인·접근 권한이 없으면 중단한다. 지원 도구의 `cdp` capability 문서를 읽는다. 현재 origin에서 `Network.enable`, `readEvents`, `Network.getResponseBody`가 지원될 때만 아래 script에 capability를 전달한다. 브라우저 자동화는 지원되는 브라우저 도구로 수행하며 script가 Chrome 프로필·쿠키·별도 debugging port에 접속하지 않는다.
2. 브라우저 도구의 JavaScript 런타임이 로컬 모듈 import와 파일 쓰기를 지원하면 아래 helper를 import한다. 경로는 현재 읽은 스킬 폴더에서 구한다. 출력은 저장소 밖의 이번 작업 전용 디렉터리로 지정한다. 지원하지 않는 런타임이면 동일 도구로 허용된 응답 본문만 파일로 내보낸 뒤 준비 script를 사용한다. 없는 런타임 기능을 추측하거나 shell의 HTTP 요청으로 대체하지 않는다.

```javascript
// skillDir와 outputDir는 현재 스킬 위치와 작업 디렉터리의 절대 경로다.
const capture = await import(`${skillDir}/scripts/capture-marketplace.mjs`);
const cdp = await tab.capabilities.get("cdp");
const session = await capture.startCapture(cdp, outputDir);
await capture.beginAction(session); // 실제 UI 조작 직전에 호출
// 브라우저 도구로 목록 표시, 한 번의 더 보기 또는 상세 열기를 수행한다.
// UI의 로딩 완료·제한 경고를 확인한다. 경고면 즉시 종료한다.
await capture.collectResponses(session);
// 후속 조작에도 beginAction → UI → collectResponses 순서를 사용한다.
// 전체 작업은 try/finally로 감싸 관찰을 종료한다.
await capture.stopCapture(session);
```

3. Helper는 `Network.requestWillBeSent`의 실제 `fb_api_req_friendly_name`, `variables`와 `doc_id`를 읽고 같은 requestId의 완료된 응답만 저장한다. `https://business.facebook.com/api/graphql/`에서 관측된 Creator Marketplace/Portfolio operation과 알려진 Marketplace 응답 구조만 허용한다. operation 이름·doc_id·cursor·브랜드 ID를 하드코딩하거나 추측해 요청하지 않는다. `Runtime.evaluate`/페이지 fetch로 GraphQL을 재생하거나 서버 요청으로 세션을 복사하지 않는다. 새 응답 구조가 발견되면 비밀값 없는 구조를 검토하고 parser를 갱신한 뒤 다시 관측한다.
4. Network event 전체, request headers, cookies, access token, `fb_dtsg`, `lsd`, `jazoest`를 출력·파일·운영 서버에 복사하지 않는다. Helper는 요청에서 필요한 메타데이터만 선택하고 세션 키가 섞인 variables/응답은 거부한다. 응답 본문과 문서별 SHA-256·실제 관측 시각·operation·variables만 권한 0600 파일로 보존한다. 업무 연락처 등 원본은 비공개 자료로 취급하며 저장소·공용 이슈에 첨부하지 않는다.

## 천천히 수집하고 중단하기

기본은 한 번에 하나의 UI 조작, 조작 시작 사이 최소 30초, 세션당 최대 10회다. 이는 차단되지 않는다는 보장이 아니다. `beginAction`이 간격·상한을 검사하며 자동 요청·대기를 실행하지 않는다. 남은 대기는 호스트의 중단 가능한 wait로 처리한다. 병렬 탭·자동 상세 순회·반복 새로고침을 사용하지 않는다. 이미 저장한 응답 해시는 준비 단계에서 중복 제거한다.

429/403/401, GraphQL errors, 로그인·체크포인트·CAPTCHA·빈 비정상 응답·수집 제한 안내가 보이면 즉시 전체 세션을 중단하고 원인과 마지막 완료 체크포인트를 남긴다. 자동 재시도·IP/계정 변경·인증 우회는 하지 않는다. `Retry-After`가 있으면 그 전에 재개하지 않으며, 재개는 사용자와 제한 상태를 확인한 뒤 별도 세션에서 수행한다. `truncated` 이벤트, 미완료 requestId나 본문 읽기 실패는 수집 완료에 포함하지 않는다. `hasMore` 이벤트 페이지를 모두 읽고 다음 collect에도 같은 session을 사용한다. 종료 시 미완료 개수를 보고한다.

## 로컬 검증과 운영 반영

```sh
bun --no-env-file <skillDir>/scripts/prepare-marketplace.mjs <captureDir> <새로운-outputDir>
```

준비 script는 저장된 원문 해시를 재검증하고 JSON/GraphQL 스트림·오류·mocked_username·세션 키를 검사해 문서 단위 최대 2 MiB의 배치와 manifest를 생성한다. 한 문서는 쪼개거나 응답 조각을 버리지 않는다. 2 MiB를 넘는 한 문서는 보류한다. 명시적 집계 기간이 variables에 없으면 기간은 미수집이며 30일로 추정하지 않는다. null·비공유 지표를 0으로 바꾸지 않는다. 계정 간 병합이나 handle 기반 ID 매핑은 수행하지 않는다.

운영 반영이 요청됐으면 현재 Admin MCP identity·허용 조직과 가져오기 계약을 새로 discovery한다. 현재 서버는 Marketplace 가져오기·원본 조회를 제공하지 않을 수 있다. 이 경우 승인된 Meta API 연결을 요구하거나 `collect_influencer_account_profiles`로 원본을 대체하지 말고 **로컬 수집 완료 / 운영 저장 미지원**으로 보고한다. 계약이 실제로 제공될 때만 해당 schema에 맞춰 조직·멱등 키·배치를 전달하며, 공개 계약의 계정 수/용량 제한이 로컬 배치보다 작으면 그 제한을 우선한다. 저장 후 계정 UUID와 외부 ID·관측 시각·원문 해시를 재조회하고 ES 검색 반영은 별도로 확인한다.

완료 보고는 실제 목록·상세·후속 페이지 수, 검색 조건, 조작 수, 오류·미완료 수, 로컬 경로·문서 해시와 운영 저장 여부를 구분한다. 일부 페이지를 전체 Marketplace로 표현하지 않는다. 코드·스킬 수정은 운영 배포나 데이터 백필 완료를 의미하지 않는다.
