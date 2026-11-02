---
name: x
description: OnGleam beta에 저장된 X 게시물과 수집 대상을 조회한다. Use to inspect saved X records only.
---

# X 저장 데이터 조회

관리자 MCP의 `get_collection_targets`와 `search_contents`만 사용한다. 대상 목록을 `limit: 20`으로 페이지 끝까지 조회하고 정확히 `platform: "x"`인 대상만 선택한다. 각 대상의 저장 게시물은 `search_contents({scope: "organization", targetId, platform: "x", limit: 20})`로 조회한다. 명시적 조직 모드로 프로젝트에 미배정된 저장 글도 포함하며 현재 조직의 접근 권한을 유지한다.

게시물 URL·본문·작성자·관측 시각을 대상과 함께 정리한다. 결과가 없으면 현재 저장된 X 데이터가 없다고 알린다. 이 스킬은 읽기 전용이며 대상 생성이나 수집 작업 시작을 하지 않는다.

응답에 `hasMore`와 `nextCursor`가 있으면 같은 targetId·platform 조건과 cursor로 다음 페이지를 조회한다.
