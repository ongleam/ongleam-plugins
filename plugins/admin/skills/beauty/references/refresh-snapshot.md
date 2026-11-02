# 전체 소비자 갱신과 독립 세션 검증

SSOT 앱에서 `bun scripts/prepare-refresh.ts <snapshot.json> <새 비공개 staging 경로>`를 실행한다. 수집 없이 이미 완료된 캡처를 재현하는 요청도 이 명령을 사용한다. `lib/refresh-snapshot.ts`의 `refreshSnapshotSchema`가 입력 계약이며 스킬에 복제하지 않는다.

캡처는 현재 MCP 계약의 응답만 사용한다. 같은 기간의 모든 콘텐츠 페이지에 `requestCursor`, `nextCursor`, `hasMore`, `items`를 보존한다. `metadata`에는 조회 전 프로젝트·전체 연결과 고정 기간을, `configurationAfter`에는 조회 후 프로젝트·전체 연결을 넣는다. `brands`, `products`는 모든 offset 응답을 합친 사전이며 마지막 응답의 `hasMore:false`, `nextOffset:null`을 보존한다. 연결·사전 중간 페이지나 오류를 숨기지 않는다. 부정 원문만 조회했다고 전체 콘텐츠를 조사한 것으로 표시하지 않는다.

명령은 단일 cursor 종료·중복 충돌·설정 변경을 검증하고 기존 builder와 매칭기로 일관된 보고서를 **staging에만** 만든다. `receipt.json`은 준비 결과이며 운영 완료 증거가 아니다. `evidence-sources.json`은 이미 매칭된 공개 원문만 담은 비공개 근거 작업 목록이다. 이 목록만 읽어 [원문 표시 기준](negative-issues.md)에 따라 모든 ID에 `{id,spans}` 결정을 배열로 작성한다. 근거가 없으면 `spans:[]`로 후보를 보존한다. `bun scripts/save-refresh.ts <준비된 staging 경로> <결정 배열.json>`이 준비 산출물의 해시·스키마와 원문 포함 여부·누락 ID를 검증한 후 공개 보고서만 저장·재조회한다. 저장 단계에서 원본 전체를 다시 집계하지 않는다. 원본 페이지·비공개 근거 파일을 공개 `data/`로 복사하지 않는다.

스킬을 바꾸면 저장소의 `skills:check`와 SSOT 앱의 `bun run test`를 실행한다. 필요하면 `bun run test:refresh:sessions --output-dir <새 절대 경로> --runs 10`으로 랜덤 입력·실제 새 세션·산출물 judge와 usage를 함께 재현한다. 공통 harness 옵션은 저장소의 `scripts/skills/cold-session.ts --help`에 있다. fixture 재현·운영 조회·운영 배포의 성공을 구분한다. 10회 통과는 같은 입력의 절차 검증이며 언어 모델의 모든 미래 실행이나 감정 판단을 보장하지 않는다.
