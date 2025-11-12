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