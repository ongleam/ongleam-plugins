# Beauty AI 근거 조회·분석·저장

이 문서는 소비자 AI 근거를 갱신하거나 별도 분석할 때만 사용한다. 자동 화면 지표는 `lib/report-api.ts`의 사용자 HTTP 경로를 사용하며 이 수동 스냅샷 절차로 덮어쓰지 않는다. 기존 감성·광고 건수는 `get_project_content_statistics` 집계로 확인하고 원문 페이지를 다시 세지 않는다.

## 연결과 범위

- SSOT 앱의 `bun scripts/refresh-context.ts`로 데이터 프로젝트·사이트 주소와 한 번 고정한 최근 7일 기간을 읽어 같은 실행 전체에 재사용한다. 사용자 지정 기간은 우선한다. operation 발견은 짧은 검색어와 기본 페이지 인자를 사용하고 선택 인자의 한도를 추측하지 않는다.
- 현재 계약을 확인하고 `get_auth_principal`, `get_auth_organizations`로 신원·접근 조직을 읽는다. 프로젝트의 조직과 대조하고 조직별 호출에는 `organizationId`를 명시한다. 오류·권한 거부는 빈 결과가 아니다.
- 실행 시작 시 프로젝트 설정·version과 `get_project_keywords`의 모든 연결을 읽는다. 분석 키워드는 **project.keywords만** 사용한다. 연결의 query나 게시판 URL을 키워드로 합치지 않는다.
- `search_contents`·`search_influencers`·`search_ads`에는 이번 분석의 `projectIds: [project.id]`를 명시한다. 생략하면 현재 조직의 모든 프로젝트가 선택되므로 단일 Beauty 보고서의 모집단을 넓히지 않는다. 단수 `projectId`나 이전 `search_project_*` 이름을 검색 도구에 전달하지 않는다.
- 플랫폼은 project.platforms, 전체 keywordLinks, 실제 관측 플랫폼의 합집합이다. 설정에 없는 커뮤니티도 포함한다. target kind가 필요하면 `get_collection_targets({ids})`를 사용한다. `{ids}`와 페이지 인자를 섞지 않고 resources는 channel 대상만 조회한다.
- 사용자 지정 기간을 우선한다. 전체 갱신 기본값은 조회 시작 시각에 고정한 최근 7일 `[from,to)`이며 시간 기준은 `publishedAt ?? observedAt`이다.

## 필요한 데이터만 조회

| 요청 | 공통 MCP 조회 | SSOT 저장 경로 |
| --- | --- | --- |
| 키워드 추이 | `get_project_content_trends`의 `includePlatforms:true` 한 번 | `build-keyword-trends.ts`가 추이와 provenance를 함께 저장·재조회 |
| 소비자·마케팅·요약·원문 근거 | `search_contents` | `prepare-refresh.ts` → 근거 판단 → `save-refresh.ts` |
| 자동 사전 | `get_brand_keywords`, `get_brand_product_keywords` | 해당 dictionary builder |
| 시장 순위 | 현재 계약의 순위 조회 | `build-market-report.ts` |
| 인플루언서 | 기존 보고서 검색 조건의 계정 조회 | `build-influencer-report.ts` |
| 수집 상태 | 연결된 channel의 resources/jobs | `build-coverage-report.ts` |
| 인사이트 | `search_project_graph`의 `SEARCHAD` 관계 | `build-search-keyword-graph.ts` |

실제 builder 입력 스키마·operation 한도는 코드와 현재 `get_tool_schema`를 따른다. 이 문서에 복제하지 않는다. 추이는 현재 계약에 `includePlatforms`가 있으면 프로젝트 키워드 전체로 **한 번만** 조회하고, 전체 응답과 `platforms`를 같은 bundle의 `overall`·`platforms`에 넣는다. 플랫폼 행의 project ID/version은 응답에 있을 때만 검증한다. 계약에 옵션이 없는 구버전 MCP에서만 전체·플랫폼별 조회로 돌아간다. 조회한 동일 페이지·사전은 실행 안에서 재사용하고, 매칭기는 사전당 한 번 준비해 여러 게시물에 적용한다. 큰 MCP 응답과 원문은 채팅에 출력하지 않고 비공개 임시 파일로 전달한다. 스킬에 정규식·정제·집계 코드를 따로 만들지 않는다.

## 전체 조회의 완료 조건

- 원문은 같은 기간·필터의 단일 PIT cursor로 `hasMore:false`까지 읽는다. 사전과 연결도 반환된 cursor/offset이 끝날 때까지 읽는다. 임의 건수 상한에서 전체 완료로 표시하지 않는다.
- 반복·누락 cursor, 만료, ID별 내용 충돌은 실패/재조회 또는 partial 사유다. 완료된 PIT와 새 첫 페이지의 늦은 수집 차이는 조회 시점 차이로 기록하며 무한 재시작하지 않는다.
- 키워드별 게시물은 겹칠 수 있으므로 키워드별 건수를 단순 합산해 전체 건수로 쓰지 않는다.
- 실행 전후 프로젝트 설정·연결이 같아야 한다. 전체/플랫폼/키워드/일별 합계와 기간을 대조한다. 한 번의 추이 응답에 포함된 플랫폼도 합계를 검증한다. 연결 플랫폼은 0건이어도 정상 응답이 필요하다. 누락·불일치에서는 마지막 정상 결과를 보존한다.
- 원문은 채팅에 대량 출력하지 않고 비공개 임시 파일에 보관한다. 완료된 단일 cursor 캡처를 `prepare-refresh.ts`에 전달한다.

## 분석과 저장

- 광고·비광고·미판정, 감성별 건수, 게시 시각 대체·작성자 누락을 구분한다. 작성자는 플랫폼과 author ID의 조합이며 공개 집계에 author ID를 저장하지 않는다.
- 기존 NEGATIVE 공개 원문에 자동 사전을 적용한다. 브랜드와 상품 이름의 교집합은 언급 후보이며 상품 불만의 인과관계가 아니다. 원문 근거·중복 제거는 [별도 기준](negative-issues.md)을 따른다.
- 추이 bundle에는 같은 실행의 project와 전체 keywordLinks를 전달한다. 기존 합계와 새 추이의 프로젝트 version·기간·모집단이 다르면 섞지 않는다.
- 순위·인플루언서 등 부가 자료의 관측 시각과 콘텐츠 기간을 구분한다. 누락 순위·지표를 만들지 않고 현재 builder의 비교 기준을 사용한다.
- 검색어 그래프는 현재 계약을 확인한 뒤 Beauty 프로젝트에 `search_project_graph`를 `source: "SEARCHAD"`, `seeds: []`, `depth: 1`, `fullGraph: false`, `nodeLimit: 100`, `edgeLimit: 300`, `minCoMentions: 1`과 고정한 기간으로 호출한다. 반환된 프로젝트 ID·version·기간·`SEARCH_KEYWORD_SUGGESTION` 관계를 요청 및 최신 프로젝트와 대조한다.
- 성공한 결과만 비공개 임시 JSON에 보관하고 SSOT 앱에서 `bun scripts/build-search-keyword-graph.ts <결과.json>`을 실행한다. `data/search-keyword-graph.json`을 재조회해 생성 시각·노드·연결·군집 수와 `truncated`/`displayTruncated`/`missingProjections`를 대조한다. 실패 시 마지막 정상 스냅샷을 보존한다. 제한된 표본은 부분 결과로 표시한다. 좌표는 builder에서 계산하며 연결 관측 횟수를 검색량으로 해석하지 않는다.
- 실제 스키마와 builder로 검증·저장한 뒤 다시 읽어 생성 시각·완전성·건수·기간을 비교한다. 실패하면 마지막 정상 파일을 유지한다. 없는 검색지수·해외 비중·분류 결과를 생성하지 않는다.
