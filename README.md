# Listening Coach

## Netflix 연결 추가

`http://localhost:3000/netflix` 등 실행 중인 로컬 앱 주소에서 연결 확장 프로그램을 다운로드하고 설치 안내를 볼 수 있습니다. 확장 0.2.2부터 localhost와 127.0.0.1의 어떤 로컬 포트에서도 연결할 수 있습니다. 일반 Chrome에서 Netflix 공식 화면에 로그인한 뒤 재생 중인 탭을 선택하세요. YouTube와 같은 문장 이동, 다중 선택, 구간 반복, 받아쓰기 채점과 메모 저장 흐름을 제공합니다. 로그인 세션은 Netflix와 브라우저가 관리하며 이 앱은 아이디·비밀번호를 저장하지 않습니다.

확장 프로그램 원본은 `extensions/netflix-companion`에 있습니다. 변경 후 `npm run netflix:package`로 다운로드 ZIP을 갱신합니다. [설치·사용법과 실제 Netflix 재생 검증의 제한](docs/NETFLIX.md)을 참고하세요.

## 현재 사용: 로컬 YouTube 연습

Vercel에서도 자막 가져오기를 지원하도록 Next.js 자막 API와 Python 함수를 추가했습니다. `requirements.txt` 및 `vercel.json`을 포함해 재배포하세요. [배포 방식과 YouTube 요청 제한](docs/YOUTUBE.md#vercel-배포)을 참고하세요.

온라인 배포 없이 사용합니다. 첫 화면에서 지정한 All Ears English 영상을 열고 **영어 자막 가져오기**를 누르세요. 영어 자막이 없으면 자동 CC를 사용해 문장별 듣기·받아쓰기·따라 말하기를 준비합니다. 반복 구간은 시·분·초로 입력하거나 현재 영상 위치로 지정할 수 있고, 전체 자막에서 여러 문장을 선택해 한 구간으로 바로 반복할 수도 있습니다.

```sh
npm run captions:setup  # 새 컴퓨터에서 최초 1회: Python 3.10+
npm run dev -- --hostname 127.0.0.1
```

[상세 사용법과 검증](docs/YOUTUBE.md). 아래는 기존 7단계 샘플 수업 설명입니다. 실제 YouTube 학습은 별도 `/youtube` 작업 화면으로 제공됩니다.

한국어 UI로 진행하는 개인용 영어 듣기 연습 앱. 첨부 명세의 학습 흐름을 구현한 **샘플 콘텐츠 기반 초기 버전**입니다. 전체 운영 MVP(M0–M4) 완료를 의미하지 않습니다.

## 구현된 흐름

- 오늘 → 온보딩 → 7단계 학습 → 완료, 30/60분 목표
- 자체 작성 영어 대본 2편, 전체/문장별 WAV 음성, 재생·일시정지·다시 듣기·속도
- 처음 듣기 2문항, 받아쓰기 6문장, 표현 4개, 다른 재청취 2문항, 따라 말하기 자기 점검
- 서버 채점, 정답 제출 전 비공개, 첫 답변 잠금, 단계 건너뛰기 기록
- D1 계정별 학습 기록, 새로고침/중단 후 이어 하기, 낙관적 잠금으로 동시 수정 방지
- 표현 저장/삭제/검색, 1→3→7→14→30일 복습, 실패 시 다음날
- 학습 기록과 표본 표시, 자료 즐겨찾기, YouTube URL 후보 보관
- ChatGPT 로그인, 데이터 전체 삭제, 모바일 레이아웃

## 실행

Node 22.13+ 필요. Next App Router API를 구현하는 Vinext/React/TypeScript를 사용하며, Sites의 비공개 게시와 D1 저장소에 맞췄습니다. 명세의 PostgreSQL 모노레포 대신 단일 앱 + Drizzle/D1입니다.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stormy_eddie_brock.sql
npm run dev -- --hostname 127.0.0.1
```

미리보기에서 Start를 누르면 로컬 전용 테스트 로그인으로 이동합니다. 게시된 앱은 실제 ChatGPT 인증을 사용합니다. 로컬 계정은 프로덕션 빌드에 포함되지 않습니다. 샘플 콘텐츠는 코드와 오디오에 포함되므로 별도 seed나 API 키가 필요 없습니다. 이미 적용한 로컬 마이그레이션을 다시 실행하지 마세요.

```sh
node --experimental-strip-types --test tests/core.test.ts
npx tsc --noEmit
npm run lint
npm run build
# 로컬 dev 서버 실행 중, 빈 테스트 계정에서 전체 API 수업 진행
node tests/api-smoke.mjs
```

`tests/api-smoke.mjs`는 로컬 테스트 기록을 생성하고 보존합니다. 기록이 이미 있으면 변경하지 않고 인증 검사까지만 진행합니다.

## 파일 구조

- `app/coach.tsx`, `app/globals.css`: 학습 UI
- `app/api/coach/route.ts`: 인증/검증/저장/채점 API
- `lib/core.ts`: 날짜, 채점, 복습 도메인
- `lib/content.ts`, `public/audio`: 자체 작성 샘플
- `db/schema.ts`, `drizzle`: 스키마와 마이그레이션
- `docs/STATUS.md`: 검증 결과와 다음 단계

## 현재 범위

샘플 오디오는 각 약 20초입니다. 30/60분은 단계별 목표이며 실제 60분 분량의 검수 수업을 공급하지 않습니다. 실제 공개 수업 사용 전 충분한 콘텐츠가 필요합니다. 두 샘플은 순환 배정되므로 14일 중복 제외 규칙을 충족하지 않습니다. 진단 추세/CEFR 수치를 만들지 않으며, AI는 사용하지 않습니다. 사용자 요청으로 로컬 전용 공개 영어 자막 가져오기 경로를 추가했습니다.

`I'd`는 샘플 문맥의 `I would`로 정규화합니다. 모든 영어 축약형의 의미를 보편적으로 판별하는 알고리즘은 아닙니다. 추가/누락 단어는 편집거리 점수에 반영되지만 단어별 diff는 아직 표시하지 않습니다.
