# 기본 회원가입 (필수 필드만)
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gesazumo@naver.com",
    "password": "12345678",
    "display_name": "홍길동",
    "phone": "010-1234-5678"
  }'

# 메타데이터 포함 회원가입
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "password123",
    "display_name": "김철수",
    "phone": "010-9876-5432",
    "metadata": {
      "preferred_language": "ko",
      "newsletter": true
    }
  }'

# 한 줄로 간단하게
curl -X POST http://localhost:3000/auth/signup -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123","display_name":"홍길동","phone":"010-1234-5678"}'

# 관리자 회원가입
curl -X POST http://localhost:3000/auth/signup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gesazumoo@gmail.com",
    "password": "12345678",
    "display_name": "관리자",
    "phone": "010-8765-4321"
  }'

# 관리자 로그인
curl -X POST http://localhost:3000/auth/signin-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gesazumoo@gmail.com",
    "password": "12345678"
  }'

# 전체 수영장 목록 조회
curl -X GET http://localhost:3000/pools

# 지역으로 필터링
curl -X GET "http://localhost:3000/pools?region=서울"

# 이름으로 검색
curl -X GET "http://localhost:3000/pools?name=올림픽"

# 지역과 이름으로 필터링 및 검색
curl -X GET "http://localhost:3000/pools?region=서울&name=올림픽"

# 수영장 레인 스케줄 집계 조회 (pool_id와 month 파라미터)
curl -X GET "http://localhost:3000/pools/{pool_id}/lane-schedule-stats?month=11"